import { NextRequest, NextResponse } from "next/server";
import { streamScenario } from "@/lib/ai/text";
import { buildChangesString } from "@/lib/ai/changes";
import { checkRateLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import { MIN_YEAR, MAX_YEAR } from "@/constants";
import type { ScenarioRequest } from "@/types";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, remaining } = await checkRateLimit(ip);

  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit: 3 },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      }
    );
  }

  let body: ScenarioRequest;
  try {
    body = (await req.json()) as ScenarioRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { year, events, lang, premium } = body;

  if (year === undefined || year === null || !events || !lang) {
    return NextResponse.json(
      { error: "year, events, and lang are required" },
      { status: 400 }
    );
  }

  if (!Number.isInteger(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return NextResponse.json(
      { error: `year out of range (${MIN_YEAR}–${MAX_YEAR})` },
      { status: 400 }
    );
  }

  const changes = buildChangesString(events);

  try {
    const stream = await streamScenario({ year, changes, lang, premium });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-RateLimit-Remaining": remaining.toString(),
        "Transfer-Encoding": "chunked",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[scenario]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
