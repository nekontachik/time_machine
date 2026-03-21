import Redis from "ioredis";

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

const EVENTS_TTL = 60 * 60 * 24; // 24 hours

export async function getCachedEvents(year: number, lang: string) {
  const r = getRedis();
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
) {
  const r = getRedis();
  if (!r) return;
  try {
    const key = `events:${year}:${lang}`;
    await r.set(key, JSON.stringify(events), "EX", EVENTS_TTL);
  } catch {
    // cache write failure is non-fatal
  }
}
