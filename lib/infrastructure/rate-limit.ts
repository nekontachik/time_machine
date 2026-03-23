import "server-only";
import { NextRequest } from "next/server";
import { getRedisClient } from "./redis-client";
import { DEFAULT_RATE_LIMIT } from "@/constants";

const FREE_LIMIT = parseInt(process.env.RATE_LIMIT_FREE ?? String(DEFAULT_RATE_LIMIT));

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
  );
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
