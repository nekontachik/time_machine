import "server-only";
import { getRedisClient } from "./redis-client";
import { EVENTS_CACHE_TTL_SECONDS } from "@/constants";

/**
 * Cache layer for historical events.
 * Uses the shared Redis client; gracefully returns null on any failure.
 *
 * Cache key version: bump CACHE_VERSION whenever:
 *   - the prompt in lib/ai/text.ts:generateEventTitles changes
 *   - the EVENTS_MODEL changes
 *   - the HistoricalEvent type gains required fields
 *
 * Old keys naturally expire after EVENTS_CACHE_TTL_SECONDS; bumping the
 * version means clients start getting fresh, schema-correct data
 * immediately instead of stale entries with the old shape.
 */
const CACHE_VERSION = "v2";

function eventsKey(year: number, lang: string): string {
  return `events:${CACHE_VERSION}:${year}:${lang}`;
}

export async function getCachedEvents(
  year: number,
  lang: string
): Promise<unknown[] | null> {
  const r = getRedisClient();
  if (!r) return null;

  try {
    const cached = await r.get(eventsKey(year, lang));
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
    await r.set(
      eventsKey(year, lang),
      JSON.stringify(events),
      "EX",
      EVENTS_CACHE_TTL_SECONDS
    );
  } catch {
    // Cache write failure is non-fatal
  }
}
