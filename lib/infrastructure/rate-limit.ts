import "server-only";
import { NextRequest } from "next/server";
import { getRedisClient } from "./redis-client";
import { DEFAULT_RATE_LIMIT } from "@/constants";

const FREE_LIMIT = parseInt(
  process.env.RATE_LIMIT_FREE ?? String(DEFAULT_RATE_LIMIT),
  10
);

/**
 * Atomic INCR + EXPIRE in a single round-trip.
 *
 * Previously these were two separate calls. If the process or the
 * connection died between INCR and EXPIRE, the key would be left without
 * a TTL — that particular IP would then be stuck at the limit forever
 * because the counter never resets. Running both ops inside a single Lua
 * script eliminates the window.
 *
 * ioredis caches the script via EVALSHA, so we only pay the script-load
 * cost once per Redis instance.
 */
const ATOMIC_INCR_EXPIRE_LUA = `
  local current = redis.call("INCR", KEYS[1])
  if current == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

export function getClientIp(req: NextRequest): string {
  // 1) Primary: first IP in x-forwarded-for chain (Vercel always sets this
  //    for public traffic). Trim whitespace and reject empty.
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (fwd) return fwd;

  // 2) Secondary: Next.js populates req.ip from the platform's edge runtime.
  //    Available on Vercel for some request types where the header is absent.
  if (req.ip) return req.ip;

  // 3) Last resort: bucket by minute so unidentified callers (internal health
  //    checks, cron warmups) don't all pool into a single "unknown" key
  //    and block each other.
  return `unknown_${Math.floor(Date.now() / 60000)}`;
}

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const r = getRedisClient();
  if (!r) return { allowed: true, remaining: FREE_LIMIT };

  try {
    const today = new Date().toISOString().split("T")[0];
    const key = `ratelimit:${ip}:${today}`;

    const count = (await r.eval(
      ATOMIC_INCR_EXPIRE_LUA,
      1,
      key,
      String(60 * 60 * 24)
    )) as number;

    const remaining = Math.max(0, FREE_LIMIT - count);
    return { allowed: count <= FREE_LIMIT, remaining };
  } catch {
    // Fail-open: if Redis is unhappy, allow the request rather than
    // block the user. The Sentry capture in redis-client.ts handles
    // visibility into the underlying connection state.
    return { allowed: true, remaining: FREE_LIMIT };
  }
}
