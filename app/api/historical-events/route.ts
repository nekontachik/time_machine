import { NextRequest, NextResponse } from "next/server";
import { generateEventTitles, enrichEventWithContext } from "@/lib/ai/text";
import { findWikipediaUrl } from "@/lib/ai/search";
import { searchEventContext } from "@/lib/tavily";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import type { EventsResponse, HistoricalEvent } from "@/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const lang = searchParams.get("lang") ?? "ua";

  if (!yearParam) {
    return NextResponse.json({ error: "year is required" }, { status: 400 });
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year) || year < -3000 || year > 2024) {
    return NextResponse.json({ error: "year out of range" }, { status: 400 });
  }

  try {
    // Cache-first
    const cached = await getCachedEvents(year, lang);
    if (cached) {
      return NextResponse.json({ year, events: cached as HistoricalEvent[] } satisfies EventsResponse);
    }

    // 1. Generate 3 event titles via AI
    const raw = await generateEventTitles(year, lang);
    const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : year.toString();

    // 2. For each event: fetch Tavily context + Wikipedia URL in parallel
    const events = await Promise.all(
      raw.map(async (e) => {
        const [tavily, wikipediaUrl] = await Promise.all([
          searchEventContext(e.title, year),
          findWikipediaUrl(`${e.title} ${yearLabel}`).then(u => u ?? undefined),
        ]);

        // 3. Rewrite description using real Tavily snippets (if any)
        const description =
          tavily.snippets.length > 0
            ? await enrichEventWithContext(e, tavily.snippets.join("\n\n"), lang)
            : e.description;

        return {
          ...e,
          description,
          thumbnail: tavily.imageUrl,
          sourceUrl: tavily.sourceUrl,
          wikipediaUrl,
        };
      })
    );

    await setCachedEvents(year, lang, events);

    return NextResponse.json({ year, events } satisfies EventsResponse);
  } catch (err) {
    console.error("[events]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
