import { NextRequest, NextResponse } from "next/server";
import { generateEvents } from "@/lib/ai/text";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import type { EventsResponse, HistoricalEvent } from "@/types";

export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, remaining, limit } = await checkBucketLimit(ip, "events");
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit },
      { status: 429, headers: { "X-RateLimit-Remaining": "0" } }
    );
  }

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
    const cached = await getCachedEvents(year, lang);
    if (cached) {
      return NextResponse.json(
        { year, events: cached as HistoricalEvent[] } satisfies EventsResponse,
        { headers: { "X-RateLimit-Remaining": String(remaining) } }
      );
    }

    const events = await generateEvents(year, lang);
    await setCachedEvents(year, lang, events);

    return NextResponse.json(
      { year, events } satisfies EventsResponse,
      { headers: { "X-RateLimit-Remaining": String(remaining) } }
    );
  } catch (err) {
    console.error("[events]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
