import { describe, it, expect, vi, beforeEach } from "vitest";

// lib/ai/text.ts is server-only
vi.mock("server-only", () => ({}));

vi.stubEnv("OPENROUTER_API_KEY", "test-key");

// ---------------------------------------------------------------------------
// Mock the OpenAI client used by lib/ai/text.ts
// ---------------------------------------------------------------------------

const mockCreate = vi.fn();

vi.mock("openai", () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    })),
  };
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompletion(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

// ---------------------------------------------------------------------------
// generateEventTitles
// ---------------------------------------------------------------------------

describe("generateEventTitles", () => {
  let generateEventTitles: typeof import("@/lib/ai/text").generateEventTitles;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    ({ generateEventTitles } = await import("@/lib/ai/text"));
  });

  it("parses JSON array from model response", async () => {
    const events = [
      { id: "1", title: "Moon Landing", description: "First human on the moon", impact: "high" },
      { id: "2", title: "Woodstock", description: "Music festival", impact: "medium" },
      { id: "3", title: "ARPANET", description: "First internet message", impact: "high" },
    ];
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(events)));

    const result = await generateEventTitles(1969, "en");

    expect(result).toHaveLength(3);
    expect(result[0].title).toBe("Moon Landing");
    expect(result[0].impact).toBe("high");
  });

  it("strips code fences before parsing JSON", async () => {
    const events = [{ id: "1", title: "Event", description: "Desc", impact: "low" }];
    mockCreate.mockResolvedValueOnce(
      makeCompletion("```json\n" + JSON.stringify(events) + "\n```")
    );

    const result = await generateEventTitles(1969, "en");

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Event");
  });

  it("throws when model returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: null } }] });

    await expect(generateEventTitles(1969, "en")).rejects.toThrow("Empty response");
  });

  it("uses BCE label for negative years in the prompt", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion("[]"));

    await generateEventTitles(-753, "en").catch(() => {}); // may throw on empty array parse

    const call = mockCreate.mock.calls[0][0];
    const userMessage = call.messages.find((m: { role: string }) => m.role === "user");
    expect(userMessage.content).toContain("753 BCE");
    expect(userMessage.content).not.toContain("-753");
  });
});

// ---------------------------------------------------------------------------
// enrichEventWithContext
// ---------------------------------------------------------------------------

describe("enrichEventWithContext", () => {
  let enrichEventWithContext: typeof import("@/lib/ai/text").enrichEventWithContext;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    ({ enrichEventWithContext } = await import("@/lib/ai/text"));
  });

  it("returns trimmed description string", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion("  Enriched description.  "));

    const event = { id: "1", title: "Moon Landing", description: "original", impact: "high" as const };
    const result = await enrichEventWithContext(event, "snippet text", "en");

    expect(result).toBe("Enriched description.");
  });

  it("throws when model returns empty content", async () => {
    mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "" } }] });

    const event = { id: "1", title: "Event", description: "desc", impact: "low" as const };
    await expect(enrichEventWithContext(event, "snippets", "en")).rejects.toThrow("Empty response");
  });
});

// ---------------------------------------------------------------------------
// generateEvents (backwards-compatibility shim)
// ---------------------------------------------------------------------------

describe("generateEvents (shim)", () => {
  it("resolves and delegates to generateEventTitles", async () => {
    vi.resetModules();
    const events = [{ id: "1", title: "T", description: "D", impact: "low" }];
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(events)));

    const { generateEvents } = await import("@/lib/ai/text");
    const result = await generateEvents(1969, "en");

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("T");
  });
});
