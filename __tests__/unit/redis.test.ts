import { describe, it, expect, vi, beforeEach } from "vitest";

// No Redis in tests
vi.stubEnv("REDIS_URL", "");

describe("Redis cache (no Redis fallback)", () => {
  let getCachedEvents: typeof import("@/lib/infrastructure/cache").getCachedEvents;
  let setCachedEvents: typeof import("@/lib/infrastructure/cache").setCachedEvents;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/infrastructure/cache");
    getCachedEvents = mod.getCachedEvents;
    setCachedEvents = mod.setCachedEvents;
  });

  it("getCachedEvents returns null when Redis is unavailable", async () => {
    const result = await getCachedEvents(1969, "en");
    expect(result).toBeNull();
  });

  it("setCachedEvents does not throw when Redis is unavailable", async () => {
    await expect(
      setCachedEvents(1969, "en", [{ id: "1", title: "Test" }])
    ).resolves.toBeUndefined();
  });
});
