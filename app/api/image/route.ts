import { NextRequest, NextResponse } from "next/server";
import { generateScenarioImage } from "@/lib/ai/image";
import { checkBucketLimit, getClientIp } from "@/lib/infrastructure/rate-limit";
import type { ImageRequest, ImageResponse } from "@/types";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const { allowed, limit } = await checkBucketLimit(ip, "image");
  if (!allowed) {
    return NextResponse.json(
      { error: "Daily limit reached", limit },
      { status: 429 }
    );
  }

  let body: ImageRequest;
  try {
    body = (await req.json()) as ImageRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { scenarioSummary, year, style } = body;

  if (!scenarioSummary || !year) {
    return NextResponse.json(
      { error: "scenarioSummary and year are required" },
      { status: 400 }
    );
  }

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
