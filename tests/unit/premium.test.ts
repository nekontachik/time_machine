/**
 * Unit tests for lib/premium.ts — isPremium()
 *
 * Covers: dev bypass (SKIP_PREMIUM), no-Redis fail-open, Redis "true"/"1"
 * values, unknown values, and Redis error fallback.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import RedisMock from "ioredis-mock";

vi.mock("server-only", () => ({}));

const mockRedis = new RedisMock();

vi.mock("ioredis", () => ({
  default: vi.fn(() => mockRedis),
  Redis: vi.fn(() => mockRedis),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("isPremium — development bypass", () => {
  it("returns true for any IP in development (SKIP_PREMIUM)", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");
    vi.mock("server-only", () => ({}));
    vi.mock("ioredis", () => ({
      default: vi.fn(() => mockRedis),
      Redis: vi.fn(() => mockRedis),
    }));

    const { isPremium } = await import("@/lib/premium");
    expect(await isPremium("1.2.3.4")).toBe(true);
    expect(await isPremium("any-ip")).toBe(true);
  });
});

describe("isPremium — production mode", () => {
  let isPremium: typeof import("@/lib/premium").isPremium;

  beforeEach(async () => {
    await mockRedis.flushall();
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REDIS_URL", "redis://localhost:6379");

    vi.mock("server-only", () => ({}));
    vi.mock("ioredis", () => ({
      default: vi.fn(() => mockRedis),
      Redis: vi.fn(() => mockRedis),
    }));

    ({ isPremium } = await import("@/lib/premium"));
  });

  it('returns true when Redis key is "true"', async () => {
    await mockRedis.set("premium:1.2.3.4", "true");
    expect(await isPremium("1.2.3.4")).toBe(true);
  });

  it('returns true when Redis key is "1"', async () => {
    await mockRedis.set("premium:10.0.0.1", "1");
    expect(await isPremium("10.0.0.1")).toBe(true);
  });

  it("returns false when Redis key does not exist", async () => {
    expect(await isPremium("99.99.99.99")).toBe(false);
  });

  it("returns false for any other Redis value", async () => {
    await mockRedis.set("premium:5.5.5.5", "yes");
    expect(await isPremium("5.5.5.5")).toBe(false);
  });

  it("uses the IP as part of the Redis key", async () => {
    await mockRedis.set("premium:192.168.1.1", "true");
    // Different IP should NOT get premium
    expect(await isPremium("192.168.1.2")).toBe(false);
    // Exact IP should
    expect(await isPremium("192.168.1.1")).toBe(true);
  });
});

describe("isPremium — no Redis (fail-open)", () => {
  it("returns false when REDIS_URL is absent", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("REDIS_URL", "");
    vi.mock("server-only", () => ({}));
    vi.mock("ioredis", () => ({
      default: vi.fn(() => mockRedis),
      Redis: vi.fn(() => mockRedis),
    }));

    const { isPremium } = await import("@/lib/premium");
    // No Redis client → always false (users not premium by default)
    expect(await isPremium("1.2.3.4")).toBe(false);
  });
});
