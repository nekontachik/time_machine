/**
 * Unit tests for lib/ai/search.ts — findWikipediaUrl()
 *
 * Uses @tavily/core via a vi.mock so no real API calls are made.
 * Validates: happy path, no API key, no Wikipedia hit, error fail-open.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Mock @tavily/core — control what `client.search()` returns
// ---------------------------------------------------------------------------

const mockSearch = vi.fn();

vi.mock("@tavily/core", () => ({
  tavily: vi.fn(() => ({ search: mockSearch })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("findWikipediaUrl", () => {
  let findWikipediaUrl: typeof import("@/lib/ai/search").findWikipediaUrl;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("TAVILY_API_KEY", "test-tavily-key");
    mockSearch.mockReset();

    vi.mock("server-only", () => ({}));
    vi.mock("@tavily/core", () => ({
      tavily: vi.fn(() => ({ search: mockSearch })),
    }));

    ({ findWikipediaUrl } = await import("@/lib/ai/search"));
  });

  it("returns null immediately when TAVILY_API_KEY is absent", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.resetModules();
    vi.mock("server-only", () => ({}));
    vi.mock("@tavily/core", () => ({
      tavily: vi.fn(() => ({ search: mockSearch })),
    }));
    const mod = await import("@/lib/ai/search");

    const result = await mod.findWikipediaUrl("Moon Landing 1969");
    expect(result).toBeNull();
    // search should never be called without an API key
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("returns the Wikipedia URL when found in results", async () => {
    mockSearch.mockResolvedValueOnce({
      results: [
        { url: "https://en.wikipedia.org/wiki/Apollo_11", title: "Apollo 11" },
        { url: "https://nasa.gov/apollo11", title: "NASA" },
      ],
    });

    const result = await findWikipediaUrl("Moon Landing 1969");

    expect(result).toBe("https://en.wikipedia.org/wiki/Apollo_11");
  });

  it("returns null when no result contains wikipedia.org", async () => {
    mockSearch.mockResolvedValueOnce({
      results: [
        { url: "https://nasa.gov/apollo11", title: "NASA" },
        { url: "https://history.com/moon", title: "History" },
      ],
    });

    const result = await findWikipediaUrl("Moon Landing 1969");

    expect(result).toBeNull();
  });

  it("returns null when results array is empty", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] });

    const result = await findWikipediaUrl("obscure event");

    expect(result).toBeNull();
  });

  it("returns null (fail-open) when client.search throws", async () => {
    mockSearch.mockRejectedValueOnce(new Error("Network error"));

    const result = await findWikipediaUrl("Moon Landing 1969");

    expect(result).toBeNull();
  });

  it("passes the query string to client.search", async () => {
    mockSearch.mockResolvedValueOnce({ results: [] });

    await findWikipediaUrl("Apollo 11 1969");

    expect(mockSearch).toHaveBeenCalledWith(
      "Apollo 11 1969",
      expect.objectContaining({ includeDomains: ["wikipedia.org"] })
    );
  });
});
