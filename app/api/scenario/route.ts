import { NextRequest, NextResponse } from "next/server";
import { streamScenario } from "@/lib/ai/text";
import { checkRateLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
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

  const { year, events, customText, lang, premium } = body;

  if (!year || !events || !lang) {
    return NextResponse.json(
      { error: "year, events, and lang are required" },
      { status: 400 }
    );
  }

  const changedEvents = events
    .filter((e) => !e.happened)
    .map((e) => `event ${e.id} did NOT happen`);

  if (customText) changedEvents.push(`Custom note: ${customText}`);

  const changes =
    changedEvents.length > 0
      ? changedEvents.join("; ")
      : "all events happened as recorded";

  try {
    const stream = await streamScenario({ year, changes, lang, premium });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-RateLimit-Remaining": remaining.toString(),
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("[scenario]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
