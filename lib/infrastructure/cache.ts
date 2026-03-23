import "server-only";
import { getRedisClient } from "./redis-client";
import { EVENTS_CACHE_TTL_SECONDS } from "@/constants";

/**
 * Cache layer for historical events.
 * Uses the shared Redis client; gracefully returns null on any failure.
 */

export async function getCachedEvents(
  year: number,
  lang: string
): Promise<unknown[] | null> {
  const r = getRedisClient();
  if (!r) return null;

  try {
    const key = `events:${year}:${lang}`;
    const cached = await r.get(key);
    if (!cached) return null;
    return JSON.parse(cached) as unknown[];
  } catch {
    return null;
  }
}

export async function setCachedEvents(
  year: number,
  lang: string,
  events: unknown[]
): Promise<void> {
  const r = getRedisClient();
  if (!r) return;

  try {
    const key = `events:${year}:${lang}`;
    await r.set(key, JSON.stringify(events), "EX", EVENTS_CACHE_TTL_SECONDS);
  } catch {
    // Cache write failure is non-fatal
  }
}
