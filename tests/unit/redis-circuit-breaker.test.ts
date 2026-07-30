import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";

/**
 * Regression test for C4 — Redis circuit-breaker.
 *
 * Mocks ioredis with an EventEmitter so we can simulate the "error"
 * event the old code reacted to permanently. Verifies that the new
 * implementation backs off for the cooldown window and then retries.
 */

class FakeRedis extends EventEmitter {
  disconnect = vi.fn();
}

const fakeClients: FakeRedis[] = [];

vi.mock("ioredis", () => ({
  default: vi.fn(() => {
    const c = new FakeRedis();
    fakeClients.push(c);
    return c;
  }),
  Redis: vi.fn(() => {
    const c = new FakeRedis();
    fakeClients.push(c);
    return c;
  }),
}));

vi.stubEnv("REDIS_URL", "redis://localhost:6379");

describe("Redis circuit-breaker", () => {
  beforeEach(() => {
    fakeClients.length = 0;
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null during the cooldown window after an error", async () => {
    const { getRedisClient } = await import("@/lib/infrastructure/redis-client");

    // First call constructs the client
    const c1 = getRedisClient();
    expect(c1).not.toBeNull();
    expect(fakeClients).toHaveLength(1);

    // Simulate connection error
    fakeClients[0].emit("error", new Error("ECONNRESET"));

    // Immediately after — should be null (cooled down)
    expect(getRedisClient()).toBeNull();
  });

  it("retries after the cooldown window expires", async () => {
    vi.useFakeTimers();
    const { getRedisClient } = await import("@/lib/infrastructure/redis-client");

    getRedisClient(); // construct
    fakeClients[0].emit("error", new Error("boom"));

    // Within cooldown
    expect(getRedisClient()).toBeNull();

    // Advance past 30s cooldown
    vi.advanceTimersByTime(31_000);

    // Should attempt to reconnect (new client constructed)
    const after = getRedisClient();
    expect(after).not.toBeNull();
    expect(fakeClients.length).toBeGreaterThanOrEqual(2);
  });
});
