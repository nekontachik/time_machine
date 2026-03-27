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
// Mock Tavily dependencies used by generateEvents
// ---------------------------------------------------------------------------

const mockSearchEventContext = vi.fn();
const mockFindWikipediaUrl = vi.fn();

vi.mock("@/lib/tavily", () => ({
  searchEventContext: (...args: unknown[]) => mockSearchEventContext(...args),
}));

vi.mock("@/lib/ai/search", () => ({
  findWikipediaUrl: (...args: unknown[]) => mockFindWikipediaUrl(...args),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeCompletion(content: string) {
  return {
    choices: [{ message: { content } }],
  };
}

const RAW_EVENTS = [
  { id: "1", title: "Moon Landing", description: "First human on the moon", impact: "high" as const },
  { id: "2", title: "Woodstock", description: "Music festival", impact: "medium" as const },
  { id: "3", title: "ARPANET", description: "First internet message", impact: "high" as const },
];

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
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(RAW_EVENTS)));

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

    await generateEventTitles(-753, "en").catch(() => {});

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
// generateEvents — full Tavily-enriched pipeline
// ---------------------------------------------------------------------------

describe("generateEvents", () => {
  let generateEvents: typeof import("@/lib/ai/text").generateEvents;

  beforeEach(async () => {
    vi.resetModules();
    mockCreate.mockReset();
    mockSearchEventContext.mockReset();
    mockFindWikipediaUrl.mockReset();

    // Default Tavily mocks: no snippets, no Wikipedia
    mockSearchEventContext.mockResolvedValue({ snippets: [] });
    mockFindWikipediaUrl.mockResolvedValue(null);

    ({ generateEvents } = await import("@/lib/ai/text"));
  });

  it("returns events with all original fields", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(RAW_EVENTS)));

    const result = await generateEvents(1969, "en");

    expect(result).toHaveLength(3);
    expect(result[0].id).toBe("1");
    expect(result[0].title).toBe("Moon Landing");
    expect(result[0].impact).toBe("high");
  });

  it("attaches thumbnail and sourceUrl from Tavily when available", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify([RAW_EVENTS[0]])));
    mockSearchEventContext.mockResolvedValue({
      snippets: ["Armstrong stepped on the moon on July 20, 1969."],
      imageUrl: "https://example.com/moon.jpg",
      sourceUrl: "https://example.com/moon",
    });
    // enrichEventWithContext call (second mockCreate)
    mockCreate.mockResolvedValueOnce(makeCompletion("Enriched: Armstrong landed on the moon."));

    const result = await generateEvents(1969, "en");

    expect(result[0].thumbnail).toBe("https://example.com/moon.jpg");
    expect(result[0].sourceUrl).toBe("https://example.com/moon");
  });

  it("uses enriched description when Tavily returns snippets", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify([RAW_EVENTS[0]])));
    mockSearchEventContext.mockResolvedValue({
      snippets: ["Real source snippet about the moon landing."],
      imageUrl: undefined,
      sourceUrl: undefined,
    });
    mockCreate.mockResolvedValueOnce(makeCompletion("Enriched description from snippets."));

    const result = await generateEvents(1969, "en");

    expect(result[0].description).toBe("Enriched description from snippets.");
  });

  it("keeps original description when Tavily returns no snippets (fail-open)", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify([RAW_EVENTS[0]])));
    mockSearchEventContext.mockResolvedValue({ snippets: [] });

    const result = await generateEvents(1969, "en");

    // enrichEventWithContext should NOT be called → original description preserved
    expect(result[0].description).toBe("First human on the moon");
    // mockCreate should only have been called once (generateEventTitles)
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("attaches wikipediaUrl when findWikipediaUrl returns a URL", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify([RAW_EVENTS[0]])));
    mockFindWikipediaUrl.mockResolvedValue("https://en.wikipedia.org/wiki/Apollo_11");

    const result = await generateEvents(1969, "en");

    expect(result[0].wikipediaUrl).toBe("https://en.wikipedia.org/wiki/Apollo_11");
  });

  it("leaves wikipediaUrl undefined when findWikipediaUrl returns null", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify([RAW_EVENTS[0]])));
    mockFindWikipediaUrl.mockResolvedValue(null);

    const result = await generateEvents(1969, "en");

    expect(result[0].wikipediaUrl).toBeUndefined();
  });

  it("calls searchEventContext and findWikipediaUrl for each event", async () => {
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(RAW_EVENTS)));

    await generateEvents(1969, "en");

    expect(mockSearchEventContext).toHaveBeenCalledTimes(3);
    expect(mockFindWikipediaUrl).toHaveBeenCalledTimes(3);
  });

  it("passes BCE label to findWikipediaUrl for negative years", async () => {
    const ancientEvent = [{ id: "1", title: "Fall of Rome", description: "Rome fell", impact: "high" as const }];
    mockCreate.mockResolvedValueOnce(makeCompletion(JSON.stringify(ancientEvent)));

    await generateEvents(-476, "en");

    expect(mockFindWikipediaUrl).toHaveBeenCalledWith(expect.stringContaining("476 BCE"));
    expect(mockFindWikipediaUrl).not.toHaveBeenCalledWith(expect.stringContaining("-476"));
  });
});
