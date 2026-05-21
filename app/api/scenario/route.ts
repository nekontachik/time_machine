import { NextRequest, NextResponse } from "next/server";
import { streamScenario } from "@/lib/ai/text";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import { parseJsonBody, ScenarioRequestSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, remaining, limit } = await checkBucketLimit(ip, "scenario");

  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit },
      {
        status: 429,
        headers: { "X-RateLimit-Remaining": "0" },
      }
    );
  }

  const result = await parseJsonBody(req, ScenarioRequestSchema);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  const { year, events, customText, lang, premium } = result.data;

  const changedEvents = events
    .filter((e) => !e.happened)
    .map((e) => (e.title ? `"${e.title}" did NOT happen` : `event ${e.id} did NOT happen`));

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
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    console.error("[scenario]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
