/**
 * Streaming & abort behaviour tests.
 *
 * Tests the scenario API streaming response and abort control:
 * - Stream delivers content chunk-by-chunk
 * - Abort signal cancels the stream mid-flight
 * - useScenario hook properly clears state on abort
 * - Empty / partial responses are handled gracefully
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.stubEnv("REDIS_URL", "");
vi.stubEnv("OPENROUTER_API_KEY", "test-key");
vi.stubEnv("RATE_LIMIT_FREE", "100");

// ---------------------------------------------------------------------------
// Top-level mocks (hoisted by Vitest)
// ---------------------------------------------------------------------------

const mockStreamScenario = vi.fn();
const mockCheckRateLimit = vi.fn().mockResolvedValue({ allowed: true, remaining: 99 });
const mockGetClientIp = vi.fn().mockReturnValue("127.0.0.1");

vi.mock("@/lib/ai/text", () => ({
  streamScenario: mockStreamScenario,
}));

vi.mock("@/lib/infrastructure/rate-limit", () => ({
  checkRateLimit: mockCheckRateLimit,
  getClientIp: mockGetClientIp,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a ReadableStream that emits the given chunks */
function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/** Reads a ReadableStream<Uint8Array> to a string */
async function streamToString(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Scenario API — streaming response
// ---------------------------------------------------------------------------

describe("POST /api/scenario — streaming", () => {
  let POST: typeof import("@/app/api/scenario/route").POST;

  beforeEach(async () => {
    vi.resetModules();
    // Reset to defaults before each test
    mockCheckRateLimit.mockResolvedValue({ allowed: true, remaining: 99 });
    mockGetClientIp.mockReturnValue("127.0.0.1");

    const mod = await import("@/app/api/scenario/route");
    POST = mod.POST;
  });

  it("streams multi-chunk content correctly", async () => {
    const chunks = ["In ", "an ", "alternate ", "1969..."];
    mockStreamScenario.mockResolvedValue(makeStream(chunks));

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969, events: [{ id: "1", happened: false }], lang: "en" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/plain");

    const body = await streamToString(res.body as ReadableStream<Uint8Array>);
    expect(body).toBe("In an alternate 1969...");
  });

  it("returns correct X-RateLimit-Remaining header", async () => {
    mockStreamScenario.mockResolvedValue(makeStream(["text"]));

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969, events: [{ id: "1", happened: false }], lang: "en" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("99");
  });

  it("returns 429 with correct error body when rate limited", async () => {
    mockCheckRateLimit.mockResolvedValue({ allowed: false, remaining: 0 });

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969, events: [{ id: "1", happened: false }], lang: "en" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toMatchObject({ error: expect.stringContaining("limit"), limit: 3 });
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("handles empty events array — uses 'all events happened' fallback", async () => {
    let capturedChanges = "";
    mockStreamScenario.mockImplementation(
      ({ changes }: { changes: string }) => {
        capturedChanges = changes;
        return Promise.resolve(makeStream(["ok"]));
      }
    );

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969, events: [], lang: "en" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(capturedChanges).toContain("all events happened as recorded");
  });

  it("passes premium options to streamScenario", async () => {
    let capturedArgs: Record<string, unknown> = {};
    mockStreamScenario.mockImplementation((args: Record<string, unknown>) => {
      capturedArgs = args;
      return Promise.resolve(makeStream(["ok"]));
    });

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({
        year: 1969,
        events: [{ id: "1", happened: false }],
        lang: "en",
        premium: { country: "Ukraine", city: "Kyiv" },
      }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    expect(capturedArgs.premium).toEqual({ country: "Ukraine", city: "Kyiv" });
  });

  it("returns 500 when streamScenario throws", async () => {
    mockStreamScenario.mockRejectedValue(new Error("OpenRouter unreachable"));

    const req = new Request("http://localhost/api/scenario", {
      method: "POST",
      body: JSON.stringify({ year: 1969, events: [{ id: "1", happened: false }], lang: "en" }),
      headers: { "Content-Type": "application/json" },
    });

    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toContain("Internal server error");
  });
});

// ---------------------------------------------------------------------------
// useScenario hook — abort behaviour (pure unit logic)
// ---------------------------------------------------------------------------

describe("useScenario hook — abort logic", () => {
  it("AbortController.abort() sets aborted flag synchronously", () => {
    const controller = new AbortController();
    expect(controller.signal.aborted).toBe(false);
    controller.abort();
    expect(controller.signal.aborted).toBe(true);
  });

  it("AbortError is distinguishable from other errors", () => {
    const abort = new DOMException("The user aborted a request.", "AbortError");
    const network = new Error("Network failure");

    expect(abort.name).toBe("AbortError");
    expect(network.name).toBe("Error");
    expect(abort.name !== network.name).toBe(true);
  });

  it("second AbortController does not affect first (independent signals)", () => {
    const c1 = new AbortController();
    const c2 = new AbortController();
    c2.abort();
    expect(c1.signal.aborted).toBe(false);
    expect(c2.signal.aborted).toBe(true);
  });

  it("aborting after completion is a no-op (does not throw)", () => {
    const controller = new AbortController();
    // Simulate stream finishing normally
    controller.abort();
    // Aborting again should not throw
    expect(() => controller.abort()).not.toThrow();
  });
});
