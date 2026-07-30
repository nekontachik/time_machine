import { NextRequest, NextResponse } from "next/server";
import { generateScenarioImage } from "@/lib/ai/image";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import { parseJsonBody, ImageRequestSchema } from "@/lib/validators";
import type { ImageResponse } from "@/types";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, limit } = await checkBucketLimit(ip, "image");
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit },
      { status: 429 }
    );
  }

  const result = await parseJsonBody(req, ImageRequestSchema);
  if (!result.ok) {
    return NextResponse.json(result.body, { status: result.status });
  }
  const { scenarioSummary, year, style } = result.data;

  try {
    const result = await generateScenarioImage(scenarioSummary, year, style);

    // generateScenarioImage returns an error descriptor for auth/billing issues
    if (typeof result === "object" && "error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({ imageUrl: result } satisfies ImageResponse);
  } catch (err) {
    // Safety net — should never reach here after the normalisation in image.ts
    console.error("[image] unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
