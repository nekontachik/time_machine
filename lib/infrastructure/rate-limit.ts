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

export function getClientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  if (req.ip) return req.ip;
  return `unknown_${Math.floor(Date.now() / 60000)}`;
}

/**
 * Extract a client IP from a plain Headers object — useful for SSR pages
 * that use next/headers instead of NextRequest.
 */
export function getClientIpFromHeaders(headers: {
  get(name: string): string | null;
}): string {
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;
  return `unknown_${Math.floor(Date.now() / 60000)}`;
}

/**
 * Check the bucket-specific rate limit for a given IP.
 * Fail-open: if Redis is unavailable, allow the request.
 */
export async function checkBucketLimit(
  ip: string,
  bucket: BucketName
): Promise<{ allowed: boolean; remaining: number; limit: number }> {
  const limit = envLimit(bucket);
  const r = getRedisClient();
  if (!r) return { allowed: true, remaining: limit, limit };

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
    return { allowed: count <= limit, remaining, limit };
  } catch {
    return { allowed: true, remaining: limit, limit };
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
