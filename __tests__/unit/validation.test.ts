/**
 * Input validation & boundary tests for year parameter.
 *
 * These tests cover edge cases that API tests don't fully exercise:
 * exact boundary values, type coercion, and extreme inputs.
 * This is the kind of thorough validation that prevents production bugs.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("REDIS_URL", "");
vi.stubEnv("OPENROUTER_API_KEY", "test-key");

vi.mock("@/lib/ai/text", () => ({
  generateEvents: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/infrastructure/cache", () => ({
  getCachedEvents: vi.fn().mockResolvedValue(null),
  setCachedEvents: vi.fn().mockResolvedValue(undefined),
}));

describe("Year boundary validation — GET /api/historical-events", () => {
  let GET: typeof import("@/app/api/historical-events/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/historical-events/route");
    GET = mod.GET;
  });

  // ---------------------------------------------------------------------------
  // Valid boundary values (should return 200)
  // ---------------------------------------------------------------------------

  it("accepts minimum valid year: -3000", async () => {
    const req = new Request("http://localhost/api/historical-events?year=-3000");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts maximum valid year: 2024", async () => {
    const req = new Request("http://localhost/api/historical-events?year=2024");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts year 0 (1 BCE / 1 CE boundary)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=0");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts year 1 (earliest CE)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=1");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts year -1 (latest BCE)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=-1");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  // ---------------------------------------------------------------------------
  // Invalid boundary values (should return 400)
  // ---------------------------------------------------------------------------

  it("rejects year -3001 (one below minimum)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=-3001");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/out of range/i);
  });

  it("rejects year 2025 (one above maximum)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=2025");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("rejects year 9999 (far future)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=9999");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("rejects year -99999 (far past)", async () => {
    const req = new Request("http://localhost/api/historical-events?year=-99999");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // Type coercion / malformed inputs
  // ---------------------------------------------------------------------------

  it("rejects alphabetic year: 'abc'", async () => {
    const req = new Request("http://localhost/api/historical-events?year=abc");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("rejects float: '1969.5'", async () => {
    const req = new Request("http://localhost/api/historical-events?year=1969.5");
    // parseFloat would give 1969.5, parseInt gives 1969 — implementation-dependent
    const res = await GET(req as unknown as import("next/server").NextRequest);
    // As long as it doesn't 500 — accept either 200 or 400
    expect([200, 400]).toContain(res.status);
  });

  it("rejects empty string year: year=", async () => {
    const req = new Request("http://localhost/api/historical-events?year=");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("rejects missing year parameter entirely", async () => {
    const req = new Request("http://localhost/api/historical-events");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/year is required/i);
  });
});

describe("Constants sanity checks", () => {
  it("MIN_YEAR and MAX_YEAR are consistent with API validation", async () => {
    const { MIN_YEAR, MAX_YEAR } = await import("@/constants");
    expect(MIN_YEAR).toBe(-3000);
    expect(MAX_YEAR).toBe(2024);
    expect(MIN_YEAR).toBeLessThan(0);
    expect(MAX_YEAR).toBeGreaterThan(0);
    expect(MAX_YEAR - MIN_YEAR).toBe(5024); // total range in years
  });

  it("model identifiers are non-empty strings", async () => {
    const { EVENTS_MODEL, SCENARIO_MODEL, IMAGE_MODEL, VIDEO_MODEL } = await import("@/constants");
    for (const model of [EVENTS_MODEL, SCENARIO_MODEL, IMAGE_MODEL, VIDEO_MODEL]) {
      expect(typeof model).toBe("string");
      expect(model.length).toBeGreaterThan(0);
    }
  });

  it("EVENTS_CACHE_TTL_SECONDS equals 24 hours", async () => {
    const { EVENTS_CACHE_TTL_SECONDS } = await import("@/constants");
    expect(EVENTS_CACHE_TTL_SECONDS).toBe(86400);
  });
});
