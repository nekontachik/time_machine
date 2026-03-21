import { NextRequest, NextResponse } from "next/server";
import { generateScenarioImage } from "@/lib/openai";
import type { ImageRequest, ImageResponse } from "@/types";

export async function POST(req: NextRequest) {
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
    const imageUrl = await generateScenarioImage(scenarioSummary, year, style);
    return NextResponse.json({ imageUrl } satisfies ImageResponse);
  } catch (err) {
    console.error("[image]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
