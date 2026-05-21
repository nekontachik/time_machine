import "server-only";
import { NextRequest } from "next/server";
import { getRedisClient } from "./redis-client";
import { DEFAULT_RATE_LIMIT } from "@/constants";

const FREE_LIMIT = parseInt(process.env.RATE_LIMIT_FREE ?? String(DEFAULT_RATE_LIMIT));

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

    const count = await r.incr(key);
    if (count === 1) {
      await r.expire(key, 60 * 60 * 24);
    }

    const remaining = Math.max(0, FREE_LIMIT - count);
    return { allowed: count <= FREE_LIMIT, remaining };
  } catch {
    return { allowed: true, remaining: FREE_LIMIT };
  }
}
