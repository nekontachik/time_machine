/**
 * Cache integration tests — Redis success paths.
 *
 * Complements redis.test.ts (which only tests the no-Redis fail-open path).
 * Uses ioredis-mock for an in-memory Redis instance.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";

vi.mock("server-only", () => ({}));

const mockRedis = new RedisMock();

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
  Redis: vi.fn(() => mockRedis),
}));

vi.stubEnv("REDIS_URL", "redis://localhost:6379");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("getCachedEvents / setCachedEvents — with in-memory Redis", () => {
  let getCachedEvents: typeof import("@/lib/infrastructure/cache").getCachedEvents;
  let setCachedEvents: typeof import("@/lib/infrastructure/cache").setCachedEvents;

  beforeEach(async () => {
    await mockRedis.flushall();
    vi.resetModules();

    vi.mock("server-only", () => ({}));
    vi.mock("ioredis", () => ({
      default: vi.fn(() => mockRedis),
      Redis: vi.fn(() => mockRedis),
    }));
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    const mod = await import("@/lib/infrastructure/cache");
    getCachedEvents = mod.getCachedEvents;
    setCachedEvents = mod.setCachedEvents;
  });

  it("getCachedEvents returns null when key does not exist", async () => {
    const result = await getCachedEvents(1969, "en");
    expect(result).toBeNull();
  });

  it("setCachedEvents stores events and getCachedEvents retrieves them", async () => {
    const events = [
      { id: "1", title: "Moon Landing", description: "First human on moon", impact: "high" },
      { id: "2", title: "Woodstock", description: "Music festival", impact: "medium" },
    ];

    await setCachedEvents(1969, "en", events);
    const cached = await getCachedEvents(1969, "en");

    expect(cached).toEqual(events);
  });

  it("cache key is scoped by year AND lang", async () => {
    const enEvents = [{ id: "1", title: "Event EN", description: "desc", impact: "high" }];
    const uaEvents = [{ id: "1", title: "Event UA", description: "опис", impact: "high" }];

    await setCachedEvents(1969, "en", enEvents);
    await setCachedEvents(1969, "ua", uaEvents);

    const cachedEn = await getCachedEvents(1969, "en");
    const cachedUa = await getCachedEvents(1969, "ua");

    expect(cachedEn).toEqual(enEvents);
    expect(cachedUa).toEqual(uaEvents);
  });

  it("different years do not share cache", async () => {
    const events1969 = [{ id: "1", title: "Moon Landing", description: "desc", impact: "high" }];

    await setCachedEvents(1969, "en", events1969);

    const cached1970 = await getCachedEvents(1970, "en");
    expect(cached1970).toBeNull();
  });

  it("setCachedEvents sets a TTL on the key", async () => {
    await setCachedEvents(2000, "en", []);

    const ttl = await mockRedis.ttl("events:v2:2000:en");
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86400); // 24 hours
  });

  it("getCachedEvents returns null on JSON.parse error (corrupted data)", async () => {
    // Manually store invalid JSON to simulate corruption
    await mockRedis.set("events:v2:1900:en", "not-valid-json");

    const result = await getCachedEvents(1900, "en");
    expect(result).toBeNull();
  });
});
