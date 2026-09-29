import { describe, it, expect, vi, beforeEach } from "vitest";

const evalMock = vi.fn();
let client: { eval: typeof evalMock } | null = null;

vi.mock("@/lib/infrastructure/redis-client", () => ({
  getRedisClient: () => client,
}));

describe("checkBucketLimit — failClosed", () => {
  let checkBucketLimit: typeof import("@/lib/infrastructure/rate-limit").checkBucketLimit;

  beforeEach(async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    client = null;
    evalMock.mockReset();
    ({ checkBucketLimit } = await import("@/lib/infrastructure/rate-limit"));
  });

  it("stays fail-open by default when Redis is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const r = await checkBucketLimit("1.1.1.1", "events");
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeUndefined();
  });

  it("blocks with reason 'unavailable' in production when Redis is missing", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const r = await checkBucketLimit("1.1.1.1", "scenario", { failClosed: true });
    expect(r).toMatchObject({ allowed: false, remaining: 0, reason: "unavailable" });
  });

  it("blocks with reason 'unavailable' in production when Redis throws", async () => {
    vi.stubEnv("NODE_ENV", "production");
    client = { eval: evalMock.mockRejectedValue(new Error("ENOTFOUND")) };
    const r = await checkBucketLimit("1.1.1.1", "image", { failClosed: true });
    expect(r).toMatchObject({ allowed: false, reason: "unavailable" });
  });

  it("does NOT fail closed outside production (local dev without Redis)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const r = await checkBucketLimit("1.1.1.1", "scenario", { failClosed: true });
    expect(r.allowed).toBe(true);
  });

  it("reports reason 'limit' when the daily quota is exhausted", async () => {
    vi.stubEnv("NODE_ENV", "production");
    client = { eval: evalMock.mockResolvedValue(999) };
    const r = await checkBucketLimit("1.1.1.1", "scenario", { failClosed: true });
    expect(r).toMatchObject({ allowed: false, remaining: 0, reason: "limit" });
  });

  it("allows under the limit with no reason", async () => {
    vi.stubEnv("NODE_ENV", "production");
    client = { eval: evalMock.mockResolvedValue(1) };
    const r = await checkBucketLimit("1.1.1.1", "scenario", { failClosed: true });
    expect(r.allowed).toBe(true);
    expect(r.reason).toBeUndefined();
  });
});
