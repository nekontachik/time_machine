import "server-only";
import { tavily } from "@tavily/core";

/**
 * Returns the top Wikipedia URL for a given query via Tavily search.
 * Fail-open: returns null if TAVILY_API_KEY is absent or the call fails.
 */
export async function findWikipediaUrl(query: string): Promise<string | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const client = tavily({ apiKey });
    const result = await client.search(query, {
      searchDepth: "basic",
      maxResults: 3,
      includeDomains: ["wikipedia.org"],
    });
    const hit = result.results.find((r) => r.url.includes("wikipedia.org"));
    return hit?.url ?? null;
  } catch {
    return null;
  }
}
