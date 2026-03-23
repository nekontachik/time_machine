import "server-only";
import Redis from "ioredis";

/**
 * Shared Redis singleton.
 *
 * All infrastructure modules (cache, rate-limit, premium) share this one
 * connection instead of creating their own, which avoids duplicate sockets
 * and simplifies error handling.
 *
 * Fail-open pattern: returns null when REDIS_URL is missing or the
 * connection is lost. Callers must handle the null case gracefully.
 */

let redis: Redis | null = null;
let redisUnavailable = false;

export function getRedisClient(): Redis | null {
  if (redisUnavailable) return null;

  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      redisUnavailable = true;
      return null;
    }

    redis = new Redis(url, {
      connectTimeout: 3_000,
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
