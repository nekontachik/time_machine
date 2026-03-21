import { NextRequest, NextResponse } from "next/server";
import { generateEvents } from "@/lib/claude";
import { getCachedEvents, setCachedEvents } from "@/lib/redis";
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

    const events = await generateEvents(year, lang);
    await setCachedEvents(year, lang, events);

    return NextResponse.json({ year, events } satisfies EventsResponse);
  } catch (err) {
    console.error("[events]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
