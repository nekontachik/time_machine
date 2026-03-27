/**
 * Tests for lib/ai/text.ts — streamScenario
 *
 * Covers the streaming alternative history generation:
 *  - Returns a ReadableStream
 *  - Streams chunks from the OpenRouter response
 *  - Handles premium localContext (city/country injection)
 *  - Handles empty stream gracefully
 *  - Propagates errors from the AI client
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));
vi.stubEnv("OPENROUTER_API_KEY", "test-key");

// ---------------------------------------------------------------------------
// Mock the OpenAI client used by lib/ai/text.ts
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  })),
}));

// Tavily / search mocks (required by the module even though streamScenario doesn't use them)
vi.mock("@/lib/tavily", () => ({
  searchEventContext: vi.fn().mockResolvedValue({ snippets: [] }),
}));
vi.mock("@/lib/ai/search", () => ({
  findWikipediaUrl: vi.fn().mockResolvedValue(null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build an async iterable that yields chat chunks like the OpenAI SDK */
function makeAsyncStream(contents: Array<string | null>) {
  return {
    [Symbol.asyncIterator]: async function* () {
      for (const content of contents) {
        yield { choices: [{ delta: { content } }] };
      }
    },
  };
}

/** Read all bytes from a ReadableStream<Uint8Array> into a string */
async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
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
// streamScenario tests
// ---------------------------------------------------------------------------

describe("streamScenario", () => {
  let streamScenario: typeof import("@/lib/ai/text").streamScenario;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    ({ streamScenario } = await import("@/lib/ai/text"));
  });

  it("returns a ReadableStream", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream(["Hello", " world"]));

    const stream = await streamScenario({ year: 1969, changes: "No moon landing", lang: "en" });

    expect(stream).toBeInstanceOf(ReadableStream);
  });

  it("streams all chunks as concatenated text", async () => {
    mockCreate.mockResolvedValueOnce(
      makeAsyncStream(["In 1969", ", the Apollo mission", " was cancelled."])
    );

    const stream = await streamScenario({ year: 1969, changes: "No moon landing", lang: "en" });
    const text = await readStream(stream);

    expect(text).toBe("In 1969, the Apollo mission was cancelled.");
  });

  it("skips null/undefined delta content without error", async () => {
    mockCreate.mockResolvedValueOnce(
      makeAsyncStream(["First", null, "Last"])
    );

    const stream = await streamScenario({ year: 2000, changes: "Y2K disaster", lang: "en" });
    const text = await readStream(stream);

    // null chunk should be skipped
    expect(text).toBe("FirstLast");
  });

  it("handles empty stream (no chunks)", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream([]));

    const stream = await streamScenario({ year: 1800, changes: "Napoleon wins", lang: "uk" });
    const text = await readStream(stream);

    expect(text).toBe("");
  });

  it("passes correct year and lang to the AI prompt", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream(["OK"]));

    await streamScenario({ year: -500, changes: "Rome never founded", lang: "uk" });

    const call = mockCreate.mock.calls[0][0];
    const userMsg = call.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("-500");
    expect(userMsg.content).toContain("uk");
    expect(userMsg.content).toContain("Rome never founded");
  });

  it("injects city/country context for premium users", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream(["Premium result"]));

    await streamScenario({
      year: 1945,
      changes: "WWII ends differently",
      lang: "en",
      premium: { country: "Ukraine", city: "Kyiv" },
    });

    const call = mockCreate.mock.calls[0][0];
    const userMsg = call.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("Kyiv");
    expect(userMsg.content).toContain("Ukraine");
  });

  it("does not include city context for non-premium users", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream(["Regular result"]));

    await streamScenario({ year: 1945, changes: "WWII", lang: "en" });

    const call = mockCreate.mock.calls[0][0];
    const userMsg = call.messages.find((m: { role: string }) => m.role === "user");
    // No city injection without premium
    expect(userMsg.content).not.toContain("Focus on impact on");
  });

  it("uses streaming mode in the API call", async () => {
    mockCreate.mockResolvedValueOnce(makeAsyncStream(["chunk"]));

    await streamScenario({ year: 1969, changes: "something", lang: "en" });

    const call = mockCreate.mock.calls[0][0];
    expect(call.stream).toBe(true);
  });
});
