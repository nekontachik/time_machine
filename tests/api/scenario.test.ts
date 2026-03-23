import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("REDIS_URL", "");
vi.stubEnv("OPENROUTER_API_KEY", "test-key");
vi.stubEnv("RATE_LIMIT_FREE", "100");

// Mock rate limit to always allow
vi.mock("@/lib/infrastructure/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true, remaining: 99 }),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

// Mock streaming scenario
const mockStream = new ReadableStream({
  start(controller) {
    controller.enqueue(new TextEncoder().encode("In an alternate timeline..."));
    controller.close();
  },
});

vi.mock("@/lib/ai/text", () => ({
  streamScenario: vi.fn().mockResolvedValue(mockStream),
}));

describe("POST /api/scenario", () => {
  let POST: typeof import("@/app/api/scenario/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/scenario/route");
    POST = mod.POST;
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields missing", async () => {
    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns streaming response for valid request", async () => {
    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      body: JSON.stringify({
        year: 1969,
        events: [{ id: "1", happened: false }],
        lang: "en",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("rate limits when limit exceeded", async () => {
    // Override mock for this test
    const { checkRateLimit } = await import("@/lib/infrastructure/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValueOnce({
      allowed: false,
      remaining: 0,
    });

    const req = new Request("http://localhost:3000/api/scenario", {
      method: "POST",
      body: JSON.stringify({
        year: 1969,
        events: [{ id: "1", happened: false }],
        lang: "en",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error).toContain("limit");
  });
});
