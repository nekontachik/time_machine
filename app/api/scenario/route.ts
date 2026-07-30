import { NextRequest, NextResponse } from "next/server";
import { streamScenario } from "@/lib/ai/text";
import { buildChangesString } from "@/lib/ai/changes";
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

  // Server-side trust boundary: the client toggle UI is NOT a trust boundary,
  // so the whole body is schema-validated before any of it reaches the model
  // prompt (see redteam/VULN_TAXONOMY.md). ScenarioRequestSchema supersedes
  // the older validateScenarioEvents() check — it enforces the same event
  // contract plus .strict() on every object and a cap on `premium`.
  const result = await parseJsonBody(req, ScenarioRequestSchema);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  const { year, events, lang, premium } = result.data;

  // Shared with the eval harness so the traces it produces use byte-identical
  // prompts. Returns NO_CHANGES_SENTINEL when nothing was toggled off, which
  // scenarioPrompt detects to avoid the none-recap failure mode.
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
