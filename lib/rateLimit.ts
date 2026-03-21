import { NextRequest } from "next/server";
import Redis from "ioredis";

const FREE_LIMIT = parseInt(process.env.RATE_LIMIT_FREE ?? '3');

let redis: Redis | null = null;
let redisUnavailable = false;

function getRedis(): Redis | null {
  if (redisUnavailable) return null;
  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      redisUnavailable = true;
      return null;
    }
    redis = new Redis(url, {
      connectTimeout: 3000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });
    redis.on("error", () => {
      redisUnavailable = true;
      redis = null;
    });
  }
  return redis;
}

export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export async function checkRateLimit(
  ip: string
): Promise<{ allowed: boolean; remaining: number }> {
  const r = getRedis();
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
