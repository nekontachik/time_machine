import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("FAL_KEY", "test-key");

// Mock the fal.ai image generation
vi.mock("@/lib/openai", () => ({
  generateScenarioImage: vi.fn().mockResolvedValue("https://fal.ai/result/test-image.jpg"),
  buildFluxPrompt: vi.fn().mockReturnValue("Test cinematic prompt"),
}));

describe("POST /api/image", () => {
  let POST: typeof import("@/app/api/image/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("@/app/api/image/route");
    POST = mod.POST;
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns 400 when required fields are missing", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      body: JSON.stringify({ year: 1969 }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  it("returns imageUrl for valid request", async () => {
    const req = new Request("http://localhost:3000/api/image", {
      method: "POST",
      body: JSON.stringify({
        scenarioSummary: "The moon landing never happened",
        year: 1969,
        style: "cinematic",
      }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toBe("https://fal.ai/result/test-image.jpg");
  });
});
