import { describe, it, expect, vi, beforeEach } from "vitest";

const redis = {
  set: vi.fn().mockResolvedValue("OK"),
  ping: vi.fn().mockResolvedValue("PONG"),
};
let client: typeof redis | null = redis;

vi.mock("@/lib/infrastructure/redis-client", () => ({
  getRedisClient: () => client,
}));

function req(auth?: string) {
  return new Request("http://localhost/api/health", {
    headers: auth ? { authorization: auth } : {},
  }) as never;
}

describe("GET /api/health (Redis keep-alive)", () => {
  let GET: typeof import("@/app/api/health/route").GET;

  beforeEach(async () => {
    vi.stubEnv("CRON_SECRET", "s3cret");
    client = redis;
    redis.set.mockClear().mockResolvedValue("OK");
    redis.ping.mockClear().mockResolvedValue("PONG");
    vi.spyOn(console, "error").mockImplementation(() => {});
    ({ GET } = await import("@/app/api/health/route"));
  });

  it("401 without the cron secret", async () => {
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req("Bearer wrong"))).status).toBe(401);
    expect(redis.set).not.toHaveBeenCalled();
  });

  it("401 when CRON_SECRET is not configured (never open by accident)", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(req("Bearer "))).status).toBe(401);
  });

  it("200 and writes the keep-alive key when Redis is up", async () => {
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ redis: "ok" });
    expect(redis.set).toHaveBeenCalledWith(
      "keepalive:last",
      expect.any(String),
      "EX",
      expect.any(Number)
    );
    expect(redis.ping).toHaveBeenCalled();
  });

  it("503 when there is no Redis client", async () => {
    client = null;
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(503);
  });

  it("503 and logs an error when Redis throws", async () => {
    redis.set.mockRejectedValueOnce(new Error("getaddrinfo ENOTFOUND"));
    const res = await GET(req("Bearer s3cret"));
    expect(res.status).toBe(503);
    expect(console.error).toHaveBeenCalled();
  });
});
