import "server-only";
import { NextRequest } from "next/server";
import { getRedisClient } from "./redis-client";
import { BUCKET_LIMITS, DEFAULT_RATE_LIMIT, type BucketName } from "@/constants";

/**
 * Per-IP daily rate limits, scoped by named buckets.
 *
 * Buckets exist so different endpoints can have different costs:
 *   scenario — Claude streaming, most expensive
 *   events   — Gemini + Tavily, mid-cost
 *   image    — Flux Schnell, expensive but bounded
 *
 * Each bucket has its own Redis key, so exhausting events doesn't lock
 * the user out of scenario or vice versa.
 *
 * Limits can be overridden via env: RATE_LIMIT_SCENARIO, RATE_LIMIT_EVENTS,
 * RATE_LIMIT_IMAGE (e.g. for staging or load tests).
 */

function envLimit(bucket: BucketName): number {
  const envName = `RATE_LIMIT_${bucket.toUpperCase()}`;
  const raw = process.env[envName];
  if (raw) {
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return BUCKET_LIMITS[bucket];
}

/** Legacy export — preserved so the existing scenario route keeps compiling. */
const FREE_LIMIT = parseInt(
  process.env.RATE_LIMIT_FREE ?? String(DEFAULT_RATE_LIMIT),
  10
);

/**
 * Atomic INCR + EXPIRE in a single round-trip.
 *
 * Previously these were two separate calls. If the process or the
 * connection died between INCR and EXPIRE, the key would be left without
 * a TTL — that particular IP would then be stuck at the limit forever.
 * Running both ops inside a single Lua script eliminates the window.
 *
 * ioredis caches the script via EVALSHA after first call.
 */
const ATOMIC_INCR_EXPIRE_LUA = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

/**
 * Resolve the client IP used as the rate-limit key.
 *
 * Order matters. The leftmost value of `x-forwarded-for` is whatever the
 * CLIENT sent — on any deployment that is not behind a normalising proxy,
 * rotating that header defeats the rate limit entirely. So we prefer, in
 * order:
 *   1. x-vercel-forwarded-for — written by the Vercel edge, not spoofable
 *   2. req.ip                 — Next.js' own resolved value
 *   3. x-forwarded-for[0]     — last resort, attacker-influenced
 *
 * The final fallback buckets by minute rather than a single constant, so a
 * deployment with no IP information degrades to a global 1-minute window
 * instead of locking every visitor out for the rest of the day.
 */
export function getClientIp(req: NextRequest): string {
  const vercel = req.headers
    .get("x-vercel-forwarded-for")
    ?.split(",")[0]
    ?.trim();
  if (vercel) return rateLimitKeyForIp(vercel);
  if (req.ip) return rateLimitKeyForIp(req.ip);
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return rateLimitKeyForIp(fwd);
  return `unknown_${Math.floor(Date.now() / 60000)}`;
}

/**
 * Collapse an IP into the unit a single client actually controls.
 *
 * IPv4 addresses are used as-is. An IPv6 subscriber is normally handed a
 * whole /64 (2^64 addresses) and can rotate through it freely, so keying on
 * the full address lets one client mint unlimited fresh buckets. IPv6 is
 * therefore keyed on its /64 prefix: `v6:2001:db8:1:2::/64`.
 *
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is unwrapped to plain IPv4 so the same
 * client is not counted in two buckets. Anything unparseable is returned
 * unchanged (it is still a stable key, just not a normalised one).
 */
export function rateLimitKeyForIp(raw: string): string {
  let ip = raw.trim();
  // Strip brackets and port: "[2001:db8::1]:443"
  const bracketed = ip.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) ip = bracketed[1];
  // Drop zone id: "fe80::1%eth0"
  ip = ip.split("%")[0];

  if (!ip.includes(":")) return ip; // IPv4 (or opaque)

  const mapped = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped) return mapped[1];

  const groups = expandIpv6(ip);
  if (!groups) return ip;
  const prefix = groups
    .slice(0, 4)
    .map((g) => parseInt(g, 16).toString(16))
    .join(":");
  return `v6:${prefix}::/64`;
}

/** Expand an IPv6 address to its 8 hex groups, or null if malformed. */
function expandIpv6(ip: string): string[] | null {
  let addr = ip.toLowerCase();
  // Trailing embedded IPv4 ("64:ff9b::1.2.3.4") → two hex groups.
  const v4 = addr.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b, c, d] = v4.slice(2).map(Number);
    if ([a, b, c, d].some((n) => n > 255)) return null;
    addr = `${v4[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }

  const halves = addr.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array(Math.max(0, missing)).fill("0"), ...tail];
  if (groups.length !== 8) return null;
  if (!groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return null;
  return groups;
}

/**
 * Extract a client IP from a plain Headers object — useful for SSR pages
 * that use next/headers instead of NextRequest.
 */
export function getClientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  // Same precedence as getClientIp — see the note there on why the
  // Vercel-written header wins over client-supplied x-forwarded-for.
  const vercel = headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return rateLimitKeyForIp(vercel);
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return rateLimitKeyForIp(fwd);
  return `unknown_${Math.floor(Date.now() / 60000)}`;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  limit: number;
  /** Why the request was blocked. Undefined when allowed. */
  reason?: "limit" | "unavailable";
};

/**
 * Check the bucket-specific rate limit for a given IP.
 *
 * Default is fail-open: if Redis is unavailable, the request is allowed.
 * Pass `{ failClosed: true }` for endpoints that spend real money per call
 * (scenario, image): when Redis is down they are refused with
 * reason "unavailable" instead of becoming unlimited. Production ran for
 * weeks with a deleted Redis and no rate limit at all before this existed.
 *
 * Fail-closed is only enforced in production, so local `npm run dev`
 * without REDIS_URL keeps working.
 */
export async function checkBucketLimit(
  ip: string,
  bucket: BucketName,
  opts: { failClosed?: boolean } = {}
): Promise<RateLimitResult> {
  const limit = envLimit(bucket);
  const failClosed =
    opts.failClosed === true && process.env.NODE_ENV === "production";
  const unavailable = (): RateLimitResult =>
    failClosed
      ? { allowed: false, remaining: 0, limit, reason: "unavailable" }
      : { allowed: true, remaining: limit, limit };

  const r = getRedisClient();
  if (!r) return unavailable();

  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `ratelimit:${bucket}:${ip}:${today}`;

    const count = (await r.eval(
      ATOMIC_INCR_EXPIRE_LUA,
      1,
      key,
      String(60 * 60 * 24)
    )) as number;

    const remaining = Math.max(0, limit - count);
    const allowed = count <= limit;
    return allowed
      ? { allowed, remaining, limit }
      : { allowed, remaining, limit, reason: "limit" };
  } catch {
    return unavailable();
  }
}

/**
 * Legacy entry point — kept so existing imports compile. Uses the
 * scenario bucket internally to preserve previous behaviour for
 * /api/scenario callers, but new code should call checkBucketLimit
 * directly with an explicit bucket name.
 *
 * @deprecated Use checkBucketLimit(ip, "scenario") instead.
 */
export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  // Preserve legacy FREE_LIMIT semantics for callers that still set
  // RATE_LIMIT_FREE rather than the per-bucket env vars.
  const r = getRedisClient();
  if (!r) return { allowed: true, remaining: FREE_LIMIT };

  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `ratelimit:scenario:${ip}:${today}`;

    const count = (await r.eval(
      ATOMIC_INCR_EXPIRE_LUA,
      1,
      key,
      String(60 * 60 * 24)
    )) as number;

    const remaining = Math.max(0, FREE_LIMIT - count);
    return { allowed: count <= FREE_LIMIT, remaining };
  } catch {
    return { allowed: true, remaining: FREE_LIMIT };
  }
}
