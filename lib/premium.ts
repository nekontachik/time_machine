import "server-only";
import Redis from "ioredis";

/**
 * Shared premium-check utility.
 *
 * Premium status is stored in Redis as `premium:{ip}` = "true" | "1".
 * In development mode, all users are treated as premium.
 */

const SKIP_PREMIUM = process.env.NODE_ENV === "development";

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

export async function isPremium(ip: string): Promise<boolean> {
  if (SKIP_PREMIUM) return true;
  const r = getRedis();
  if (!r) return false;
  try {
    const val = await r.get(`premium:${ip}`);
    return val === "true" || val === "1";
  } catch {
    return false;
  }
}
