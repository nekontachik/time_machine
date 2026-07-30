import { NextRequest, NextResponse } from "next/server";
import { generateEvents } from "@/lib/ai/text";
import { getCachedEvents, setCachedEvents } from "@/lib/infrastructure/cache";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import { LangSchema, YearParamSchema } from "@/lib/validators";
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

  const yearParsed = YearParamSchema.safeParse(searchParams.get("year"));
  if (!yearParsed.success) {
    return NextResponse.json(
      { error: "Invalid year", details: yearParsed.error.flatten() },
      { status: 400 }
    );
  }
  const year = yearParsed.data;

  const langParsed = LangSchema.safeParse(searchParams.get("lang") ?? "en");
  if (!langParsed.success) {
    return NextResponse.json(
      { error: "Invalid lang — the product ships in English only" },
      { status: 400 }
    );
  }
  const lang = langParsed.data;

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
