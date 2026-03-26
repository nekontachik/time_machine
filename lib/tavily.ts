import "server-only";

interface TavilyResult {
  snippets: string[];
  imageUrl?: string;
  sourceUrl?: string;
}

export async function searchEventContext(
  title: string,
  year: number
): Promise<TavilyResult> {
  try {
    const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : String(year);
    const query = `${title} ${yearLabel} historical event`;

    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        max_results: 3,
        include_images: true,
        search_depth: "basic",
      }),
    });

    if (!res.ok) return { snippets: [] };

    const data = await res.json();
    const results = data.results ?? [];
    const images: string[] = data.images ?? [];

    return {
      snippets: results.slice(0, 2).map((r: { content?: string }) => r.content ?? ""),
      imageUrl: images[0] ?? results[0]?.image ?? undefined,
      sourceUrl: results[0]?.url ?? undefined,
    };
  } catch {
    return { snippets: [] };
  }
}
