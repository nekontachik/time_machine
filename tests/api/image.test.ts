import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("FAL_KEY", "test-key");

// ---------------------------------------------------------------------------
// Default mock — fal.ai succeeds
// ---------------------------------------------------------------------------

const mockGenerateScenarioImage = vi.fn().mockResolvedValue(
  "https://fal.ai/result/test-image.jpg"
);

vi.mock("@/lib/ai/image", () => ({
  generateScenarioImage: mockGenerateScenarioImage,
  buildFluxPrompt: vi.fn().mockReturnValue("Test cinematic prompt"),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new Request("http://localhost:3000/api/image", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/image", () => {
  let POST: typeof import("@/app/api/image/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    mockGenerateScenarioImage.mockResolvedValue(
      "https://fal.ai/result/test-image.jpg"
    );

    // Re-apply mock after resetModules
    vi.mock("@/lib/ai/image", () => ({
      generateScenarioImage: mockGenerateScenarioImage,
      buildFluxPrompt: vi.fn().mockReturnValue("Test cinematic prompt"),
    }));

    const mod = await import("@/app/api/image/route");
    POST = mod.POST;
  });

  // ── Input validation ────────────────────────────────────────────────────

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
    const res = await POST(
      makeRequest({ year: 1969 }) as unknown as import("next/server").NextRequest
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when scenarioSummary is missing", async () => {
    const res = await POST(
      makeRequest({ year: 1969, style: "cinematic" }) as unknown as import("next/server").NextRequest
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when year is missing", async () => {
    const res = await POST(
      makeRequest({ scenarioSummary: "something happened" }) as unknown as import("next/server").NextRequest
    );
    expect(res.status).toBe(400);
  });

  // ── Success path ────────────────────────────────────────────────────────

  it("returns imageUrl for valid request", async () => {
    const res = await POST(
      makeRequest({
        scenarioSummary: "The moon landing never happened",
        year: 1969,
        style: "cinematic",
      }) as unknown as import("next/server").NextRequest
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toBe("https://fal.ai/result/test-image.jpg");
  });

  it("passes scenarioSummary and year to generateScenarioImage", async () => {
    const summary = "Apollo program was cancelled in 1966";
    const year = 1966;

    await POST(
      makeRequest({ scenarioSummary: summary, year, style: "cinematic" }) as unknown as import("next/server").NextRequest
    );

    expect(mockGenerateScenarioImage).toHaveBeenCalledWith(
      summary,
      year,
      "cinematic"
    );
  });

  it("returns imageUrl as-is without transformation", async () => {
    const url = "https://cdn.fal.ai/generated/abc123.jpg";
    mockGenerateScenarioImage.mockResolvedValueOnce(url);

    const res = await POST(
      makeRequest({
        scenarioSummary: "Some scenario",
        year: 2000,
      }) as unknown as import("next/server").NextRequest
    );

    const body = await res.json();
    expect(body.imageUrl).toBe(url);
  });

  // ── Fallback / placeholder path ─────────────────────────────────────────

  it("returns 200 with placeholder URL when fal.ai fails silently (ancient era)", async () => {
    // generateScenarioImage swallows fal.ai errors and returns a placeholder
    mockGenerateScenarioImage.mockResolvedValueOnce("/placeholder-ancient.jpg");

    const res = await POST(
      makeRequest({
        scenarioSummary: "Caesar was never assassinated",
        year: -44,
        style: "cinematic",
      }) as unknown as import("next/server").NextRequest
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    // API passes the placeholder through — the UI decides whether to render it
    expect(body.imageUrl).toBe("/placeholder-ancient.jpg");
  });

  it("returns 200 with placeholder URL for modern era fallback", async () => {
    mockGenerateScenarioImage.mockResolvedValueOnce("/placeholder-modern.jpg");

    const res = await POST(
      makeRequest({
        scenarioSummary: "WWI never happened",
        year: 1914,
      }) as unknown as import("next/server").NextRequest
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.imageUrl).toBe("/placeholder-modern.jpg");
  });

  it("returns 200 with placeholder URL for future era fallback", async () => {
    mockGenerateScenarioImage.mockResolvedValueOnce("/placeholder-future.jpg");

    const res = await POST(
      makeRequest({
        scenarioSummary: "Moon landing cancelled",
        year: 1969,
      }) as unknown as import("next/server").NextRequest
    );

    const body = await res.json();
    expect(body.imageUrl).toBe("/placeholder-future.jpg");
  });

  it("returns 500 only if generateScenarioImage throws (unexpected)", async () => {
    // This should not normally happen — generateScenarioImage is designed to
    // never throw. If it does (programming error), the route must return 500.
    mockGenerateScenarioImage.mockRejectedValueOnce(
      new Error("Unexpected fatal error")
    );

    const res = await POST(
      makeRequest({
        scenarioSummary: "Some scenario",
        year: 1969,
      }) as unknown as import("next/server").NextRequest
    );

    expect(res.status).toBe(500);
  });
});
