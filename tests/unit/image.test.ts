/**
 * Tests for lib/ai/image.ts
 *
 * Covers:
 *  - FalAuthError class
 *  - normalizeFalError (via generateScenarioImage error paths)
 *  - generateScenarioImage: success, retry, FalAuthError bail-out, placeholder fallback
 *
 * fal.subscribe is mocked so no real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("FAL_KEY", "test-fal-key");

// ---------------------------------------------------------------------------
// Mock @fal-ai/client
// ---------------------------------------------------------------------------

const mockFalSubscribe = vi.fn();

vi.mock("@fal-ai/client", () => ({
  fal: {
    config: vi.fn(),
    subscribe: (...args: unknown[]) => mockFalSubscribe(...args),
  },
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSuccessResult(url: string) {
  return { data: { images: [{ url }] } };
}

// ---------------------------------------------------------------------------
// Imports (after mocks are set up)
// ---------------------------------------------------------------------------

import {
  buildFluxPrompt,
  generateScenarioImage,
  FalAuthError,
} from "@/lib/ai/image";

// ---------------------------------------------------------------------------
// FalAuthError
// ---------------------------------------------------------------------------

describe("FalAuthError", () => {
  it("has the correct name and message", () => {
    const err = new FalAuthError("billing limit exceeded");
    expect(err.name).toBe("FalAuthError");
    expect(err.message).toBe("billing limit exceeded");
    expect(err).toBeInstanceOf(Error);
  });
});

// ---------------------------------------------------------------------------
// generateScenarioImage — success paths
// ---------------------------------------------------------------------------

describe("generateScenarioImage — success", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns image URL on first successful call", async () => {
    mockFalSubscribe.mockResolvedValueOnce(
      makeSuccessResult("https://fal.media/img/success.jpg")
    );

    const result = await generateScenarioImage("Great victory", 1945, "cinematic", "WWII ends");

    expect(result).toBe("https://fal.media/img/success.jpg");
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("uses event + scenarioSummary in prompt when event is provided", async () => {
    mockFalSubscribe.mockResolvedValueOnce(
      makeSuccessResult("https://fal.media/img/1.jpg")
    );

    await generateScenarioImage("Alternative scenario", 1969, "cinematic", "Moon landing cancelled");

    const calledPrompt = mockFalSubscribe.mock.calls[0][1].input.prompt;
    expect(calledPrompt).toContain("Moon landing cancelled");
    expect(calledPrompt).toContain("1969 AD");
  });

  it("uses scenarioSummary for both args when event is empty", async () => {
    mockFalSubscribe.mockResolvedValueOnce(
      makeSuccessResult("https://fal.media/img/2.jpg")
    );

    await generateScenarioImage("No event provided", 1776);

    const calledPrompt = mockFalSubscribe.mock.calls[0][1].input.prompt;
    expect(calledPrompt).toContain("No event provided");
  });
});

// ---------------------------------------------------------------------------
// generateScenarioImage — retry logic
// ---------------------------------------------------------------------------

describe("generateScenarioImage — retry logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries on transient error and succeeds on second attempt", async () => {
    mockFalSubscribe
      .mockRejectedValueOnce(new Error("Network timeout"))
      .mockResolvedValueOnce(makeSuccessResult("https://fal.media/img/retry.jpg"));

    const result = await generateScenarioImage("Scenario", 2000);

    expect(result).toBe("https://fal.media/img/retry.jpg");
    expect(mockFalSubscribe).toHaveBeenCalledTimes(2);
  });

  it("returns placeholder URL after all attempts fail (ancient year)", async () => {
    mockFalSubscribe.mockRejectedValue(new Error("Service unavailable"));

    const result = await generateScenarioImage("Scenario", -500);

    expect(result).toBe("/placeholder-ancient.jpg");
    // IMAGE_MAX_ATTEMPTS = 2
    expect(mockFalSubscribe).toHaveBeenCalledTimes(2);
  });

  it("returns modern placeholder for year 1850", async () => {
    mockFalSubscribe.mockRejectedValue(new Error("Service unavailable"));

    const result = await generateScenarioImage("Scenario", 1850);
    expect(result).toBe("/placeholder-modern.jpg");
  });

  it("returns future placeholder for year 2020", async () => {
    mockFalSubscribe.mockRejectedValue(new Error("Service unavailable"));

    const result = await generateScenarioImage("Scenario", 2020);
    expect(result).toBe("/placeholder-future.jpg");
  });
});

// ---------------------------------------------------------------------------
// generateScenarioImage — auth/billing errors (no retry)
// ---------------------------------------------------------------------------

describe("generateScenarioImage — FalAuthError bail-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns error object immediately on 401 message", async () => {
    mockFalSubscribe.mockRejectedValueOnce(new Error("401 Unauthorized"));

    const result = await generateScenarioImage("Scenario", 1900);

    expect(result).toEqual({ error: "fal_auth", status: 402 });
    // Should NOT retry — only 1 call
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("bails on 'unauthorized' in message", async () => {
    mockFalSubscribe.mockRejectedValueOnce(new Error("unauthorized access"));

    const result = await generateScenarioImage("Scenario", 1900);
    expect(result).toEqual({ error: "fal_auth", status: 402 });
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("bails on 'billing' in message", async () => {
    mockFalSubscribe.mockRejectedValueOnce(new Error("billing limit reached"));

    const result = await generateScenarioImage("Scenario", 1900);
    expect(result).toEqual({ error: "fal_auth", status: 402 });
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("bails on 'quota' in message", async () => {
    mockFalSubscribe.mockRejectedValueOnce(new Error("quota exceeded"));

    const result = await generateScenarioImage("Scenario", 1900);
    expect(result).toEqual({ error: "fal_auth", status: 402 });
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("bails when fal throws plain object with status 401", async () => {
    mockFalSubscribe.mockRejectedValueOnce({ status: 401, message: "Unauthorized" });

    const result = await generateScenarioImage("Scenario", 1900);
    expect(result).toEqual({ error: "fal_auth", status: 402 });
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });

  it("bails when fal throws plain object with status 402", async () => {
    mockFalSubscribe.mockRejectedValueOnce({ status: 402, detail: "Payment required" });

    const result = await generateScenarioImage("Scenario", 1900);
    expect(result).toEqual({ error: "fal_auth", status: 402 });
    expect(mockFalSubscribe).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// generateScenarioImage — edge cases
// ---------------------------------------------------------------------------

describe("generateScenarioImage — edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("falls back to placeholder when fal returns no image URL", async () => {
    mockFalSubscribe.mockResolvedValue({ data: { images: [] } });

    const result = await generateScenarioImage("Scenario", 1500);
    expect(result).toBe("/placeholder-modern.jpg");
  });

  it("handles non-Error throw (plain string)", async () => {
    mockFalSubscribe.mockRejectedValue("connection reset");

    const result = await generateScenarioImage("Scenario", 1800);
    // Should not throw, should return placeholder after retries
    expect(typeof result).toBe("string");
    expect(result).toContain("placeholder");
  });
});

// ---------------------------------------------------------------------------
// buildFluxPrompt (already tested, just sanity-check era for BC)
// ---------------------------------------------------------------------------

describe("buildFluxPrompt — era formatting", () => {
  it("formats year 0 as 0 AD", () => {
    const prompt = buildFluxPrompt("event", "scenario", 0);
    expect(prompt).toContain("0 AD");
  });

  it("formats year -1 as 1 BC", () => {
    const prompt = buildFluxPrompt("event", "scenario", -1);
    expect(prompt).toContain("1 BC");
  });
});
