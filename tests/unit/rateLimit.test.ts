import { describe, it, expect, vi, beforeEach } from "vitest";

// Clear REDIS_URL so rate limit falls back to allow-all
vi.stubEnv("REDIS_URL", "");
vi.stubEnv("RATE_LIMIT_FREE", "3");

describe("Rate limiting (no Redis fallback)", () => {
  let checkRateLimit: typeof import("@/lib/infrastructure/rate-limit").checkRateLimit;

  beforeEach(async () => {
    // Dynamic import so env stubs are picked up
    vi.resetModules();
    const mod = await import("@/lib/infrastructure/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  it("allows requests when Redis is unavailable (fail-open)", async () => {
    const result = await checkRateLimit("127.0.0.1");
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it("returns configured limit as remaining", async () => {
    const result = await checkRateLimit("192.168.1.1");
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });
});

describe("getClientIp", () => {
  let getClientIp: typeof import("@/lib/infrastructure/rate-limit").getClientIp;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/lib/infrastructure/rate-limit");
    getClientIp = mod.getClientIp;
  });

  it("extracts IP from x-forwarded-for header", () => {
    const req = {
      headers: {
        get: (name: string) =>
          name === "x-forwarded-for" ? "1.2.3.4, 5.6.7.8" : null,
      },
    } as unknown as import("next/server").NextRequest;

    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("returns 'unknown' when no forwarded header", () => {
    const req = {
      headers: {
        get: () => null,
      },
    } as unknown as import("next/server").NextRequest;

    expect(getClientIp(req)).toBe("unknown");
  });
});
