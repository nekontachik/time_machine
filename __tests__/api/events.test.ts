import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub env
vi.stubEnv("REDIS_URL", "");
vi.stubEnv("OPENROUTER_API_KEY", "test-key");

// Mock the lib modules
vi.mock("@/lib/ai/text", () => ({
  generateEvents: vi.fn().mockResolvedValue([
    { id: "1", title: "Moon Landing", description: "First human on the moon", impact: "high" },
    { id: "2", title: "Woodstock", description: "Music festival", impact: "medium" },
    { id: "3", title: "Internet born", description: "ARPANET first message", impact: "high" },
    { id: "4", title: "Concorde", description: "First supersonic flight", impact: "medium" },
    { id: "5", title: "Stonewall", description: "Stonewall riots", impact: "high" },
  ]),
}));

vi.mock("@/lib/infrastructure/cache", () => ({
  getCachedEvents: vi.fn().mockResolvedValue(null),
  setCachedEvents: vi.fn().mockResolvedValue(undefined),
}));

describe("GET /api/historical-events", () => {
  let GET: typeof import("@/app/api/historical-events/route").GET;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/historical-events/route");
    GET = mod.GET;
  });

  it("returns 400 when year param is missing", async () => {
    const req = new Request("http://localhost:3000/api/historical-events");
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("year");
  });

  it("returns 400 for out-of-range year", async () => {
    const req = new Request(
      "http://localhost:3000/api/historical-events?year=9999"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-numeric year", async () => {
    const req = new Request(
      "http://localhost:3000/api/historical-events?year=abc"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns events for a valid year", async () => {
    const req = new Request(
      "http://localhost:3000/api/historical-events?year=1969&lang=en"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(1969);
    expect(body.events).toHaveLength(5);
    expect(body.events[0]).toHaveProperty("id");
    expect(body.events[0]).toHaveProperty("title");
  });

  it("defaults lang to 'ua' when not provided", async () => {
    const req = new Request(
      "http://localhost:3000/api/historical-events?year=1969"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("accepts negative years (BCE)", async () => {
    const req = new Request(
      "http://localhost:3000/api/historical-events?year=-500"
    );
    const res = await GET(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(-500);
  });
});
