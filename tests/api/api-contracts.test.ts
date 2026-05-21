import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// API Contract Tests — moved from Playwright e2e/api-contracts.spec.ts
// These verify request/response shapes (error handling + input validation)
// without needing a running browser or real API keys.
// ---------------------------------------------------------------------------

// ─── Shared mocks ──────────────────────────────────────────────────────────

vi.stubEnv("OPENROUTER_API_KEY", "test-key");
vi.stubEnv("FAL_KEY", "");
vi.stubEnv("REDIS_URL", "");
vi.stubEnv("NODE_ENV", "development"); // enables SKIP_PREMIUM

vi.mock("@/lib/redis", () => ({
  getCachedEvents: vi.fn().mockResolvedValue(null),
  setCachedEvents: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/claude", () => ({
  generateEvents: vi.fn().mockResolvedValue([]),
  generateScenario: vi.fn().mockResolvedValue(new ReadableStream()),
}));

vi.mock("@/lib/openai", () => ({
  generateImage: vi.fn().mockResolvedValue({ url: "https://example.com/img.jpg" }),
  buildFluxPrompt: vi.fn().mockReturnValue("prompt"),
}));

vi.mock("@/lib/rateLimit", () => ({
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
}));

// ─── /api/historical-events ────────────────────────────────────────────────

describe("GET /api/historical-events", () => {
  let GET: typeof import("@/app/api/historical-events/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/historical-events/route");
    GET = mod.GET;
  });

  it("returns 400 without year parameter", async () => {
    const req = new Request("http://localhost:3000/api/historical-events");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("returns 400 for out-of-range year", async () => {
    const req = new Request("http://localhost:3000/api/historical-events?year=99999");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric year", async () => {
    const req = new Request("http://localhost:3000/api/historical-events?year=hello");
    const res = await GET(req as never);
    expect(res.status).toBe(400);
  });
});

// ─── /api/scenario ─────────────────────────────────────────────────────────

describe("POST /api/scenario", () => {
  let POST: typeof import("@/app/api/scenario/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/scenario/route");
    POST = mod.POST;
  });

  it("returns 400 for empty body", async () => {
    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing events", async () => {
    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 1969, lang: "en" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});

// ─── /api/image ────────────────────────────────────────────────────────────

describe("POST /api/image", () => {
  let POST: typeof import("@/app/api/image/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/image/route");
    POST = mod.POST;
  });

  it("returns 400 for empty body", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 without scenarioSummary", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year: 1969 }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });
});
