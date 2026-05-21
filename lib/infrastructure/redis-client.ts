import "server-only";
import Redis from "ioredis";

/**
 * Shared Redis singleton with circuit-breaker.
 *
 * All infrastructure modules (cache, rate-limit) share this one connection
 * instead of creating their own, which avoids duplicate sockets and
 * simplifies error handling.
 *
 * Fail-open pattern: returns null when REDIS_URL is missing or the
 * connection is currently unavailable. Callers must handle the null case
 * gracefully.
 *
 * Circuit-breaker: a single transient `error` event used to mark the
 * client permanently unavailable for the lifetime of the process. That
 * meant one network blip disabled rate-limiting and caching until the
 * next deploy. Now we cool down for COOLDOWN_MS after a failure and
 * retry the connection.
 */

let redis: Redis | null = null;
let unavailableUntil = 0;

/** Cooldown after a connection error before we attempt to reconnect. */
const COOLDOWN_MS = 30_000;

export function getRedisClient(): Redis | null {
  if (Date.now() < unavailableUntil) return null;

  if (!redis) {
    const url = process.env.REDIS_URL;
    if (!url) {
      // No URL configured — back off for the cooldown window before
      // re-checking (useful if env vars are hot-swapped via Vercel).
      unavailableUntil = Date.now() + COOLDOWN_MS;
      return null;
    }

    redis = new Redis(url, {
      connectTimeout: 3_000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    redis.on("error", (err) => {
      console.warn(
        `[redis] connection error — cooling down ${COOLDOWN_MS}ms:`,
        err.message
      );
      unavailableUntil = Date.now() + COOLDOWN_MS;
      try {
        redis?.disconnect();
      } catch {
        /* ignore — already closed */
      }
      redis = null;
    });
  }

  return redis;
}

/**
 * Test-only: reset the module state. Vitest can call this from beforeEach
 * via dynamic import to ensure isolation between tests without resetModules.
 */
export function __resetRedisClientForTests(): void {
  try {
    redis?.disconnect();
  } catch {
    /* ignore */
  }
  redis = null;
  unavailableUntil = 0;
}
