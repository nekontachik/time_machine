import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// lib/tavily.ts is server-only — mock the sentinel to avoid import errors in test env
vi.mock("server-only", () => ({}));

describe("searchEventContext", () => {
  let searchEventContext: typeof import("@/lib/tavily").searchEventContext;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv("TAVILY_API_KEY", "test-tavily-key");
    ({ searchEventContext } = await import("@/lib/tavily"));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns snippets, imageUrl and sourceUrl on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { content: "Neil Armstrong landed on the moon.", url: "https://example.com/moon", image: undefined },
            { content: "Apollo 11 mission details.", url: "https://example.com/apollo", image: undefined },
          ],
          images: ["https://example.com/moon.jpg"],
        }),
      })
    );

    const result = await searchEventContext("Moon Landing", 1969);

    expect(result.snippets).toHaveLength(2);
    expect(result.snippets[0]).toBe("Neil Armstrong landed on the moon.");
    expect(result.imageUrl).toBe("https://example.com/moon.jpg");
    expect(result.sourceUrl).toBe("https://example.com/moon");
  });

  it("falls back to results[0].image when data.images is empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          results: [
            { content: "Some content.", url: "https://example.com/src", image: "https://example.com/img.jpg" },
          ],
          images: [],
        }),
      })
    );

    const result = await searchEventContext("Some Event", 1900);

    expect(result.imageUrl).toBe("https://example.com/img.jpg");
  });

  it("returns empty snippets on non-ok HTTP response (fail-open)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false })
    );

    const result = await searchEventContext("Moon Landing", 1969);

    expect(result).toEqual({ snippets: [] });
  });

  it("returns empty snippets when fetch throws (fail-open)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network error"))
    );

    const result = await searchEventContext("Moon Landing", 1969);

    expect(result).toEqual({ snippets: [] });
  });

  it("builds query with BCE suffix for negative years", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], images: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchEventContext("Fall of Rome", -476);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.query).toContain("476 BCE");
    expect(body.query).not.toContain("-476");
  });

  it("builds query without BCE suffix for positive years", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], images: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchEventContext("Moon Landing", 1969);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.query).toContain("1969");
    expect(body.query).not.toContain("BCE");
  });

  it("sends TAVILY_API_KEY in request body", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [], images: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    await searchEventContext("Moon Landing", 1969);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.api_key).toBe("test-tavily-key");
  });
});
