/**
 * Rate limit integration tests — with in-memory Redis (ioredis-mock).
 *
 * These tests exercise the full Redis counter logic — increment, TTL, and
 * enforcement — without a real Redis server.  They complement the existing
 * rateLimit.test.ts which only tests the "no-Redis / fail-open" path.
 *
 * Package: ioredis-mock — drop-in in-memory ioredis replacement.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";

// ---------------------------------------------------------------------------
// Setup: mock the ioredis module so rate-limit uses our in-memory instance
// ---------------------------------------------------------------------------

const mockRedis = new RedisMock();

vi.mock("ioredis", () => {
  return {
    default: vi.fn(() => mockRedis),
    // Named export required by some import paths
    Redis: vi.fn(() => mockRedis),
  };
});

// Provide a dummy REDIS_URL so the module doesn't go into unavailable mode
vi.stubEnv("REDIS_URL", "redis://localhost:6379");
vi.stubEnv("RATE_LIMIT_FREE", "3");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkRateLimit — with in-memory Redis", () => {
  let checkRateLimit: (ip: string) => Promise<{ allowed: boolean; remaining: number }>;

  beforeEach(async () => {
    // Flush the mock Redis between tests for isolation
    await mockRedis.flushall();
    vi.resetModules();

    // Re-apply mock + env stubs after resetModules
    vi.mock("ioredis", () => ({
      default: vi.fn(() => mockRedis),
      Redis: vi.fn(() => mockRedis),
    }));
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.stubEnv("RATE_LIMIT_FREE", "3");

    const mod = await import("@/lib/infrastructure/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  it("allows first request — remaining = LIMIT - 1", async () => {
    const result = await checkRateLimit("1.2.3.4");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2); // 3 - 1
  });

  it("allows requests up to the limit", async () => {
    for (let i = 0; i < 3; i++) {
      const result = await checkRateLimit("2.2.2.2");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks request when limit is exceeded", async () => {
    // Exhaust the limit
    for (let i = 0; i < 3; i++) {
      await checkRateLimit("3.3.3.3");
    }
    // 4th request should be blocked
    const result = await checkRateLimit("3.3.3.3");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("remaining decrements correctly across multiple requests", async () => {
    const ip = "4.4.4.4";

    const r1 = await checkRateLimit(ip);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit(ip);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit(ip);
    expect(r3.remaining).toBe(0);
  });

  it("different IPs have independent counters", async () => {
    // Exhaust limit for IP A
    for (let i = 0; i < 3; i++) await checkRateLimit("10.0.0.1");
    const blocked = await checkRateLimit("10.0.0.1");
    expect(blocked.allowed).toBe(false);

    // IP B should still be allowed
    const allowed = await checkRateLimit("10.0.0.2");
    expect(allowed.allowed).toBe(true);
    expect(allowed.remaining).toBe(2);
  });

  it("rate limit key includes today's date (TTL scope)", async () => {
    const today = new Date().toISOString().split("T")[0];
    await checkRateLimit("5.5.5.5");

    const key = `ratelimit:scenario:5.5.5.5:${today}`;
    const value = await mockRedis.get(key);
    expect(value).toBe("1");
  });

  it("key has a TTL set (expires after 24h)", async () => {
    const today = new Date().toISOString().split("T")[0];
    await checkRateLimit("6.6.6.6");

    const key = `ratelimit:scenario:6.6.6.6:${today}`;
    const ttl = await mockRedis.ttl(key);
    // TTL should be set and ≤ 86400 (24h)
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(86400);
  });
});
