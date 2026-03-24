/**
 * Dev-only endpoint for testing Flux image generation.
 * Returns 404 in production to prevent abuse.
 */
import { NextRequest, NextResponse } from "next/server"
import { buildFluxPrompt, generateScenarioImage } from "@/lib/ai/image"

interface TestFluxRequest {
  event: string
  scenario: string
  year: number
}

interface TestFluxResponse {
  imageUrl: string
  prompt: string
  generationTimeMs: number
  model: string
}

export async function POST(req: NextRequest) {
  // Block in production
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  let body: TestFluxRequest
  try {
    body = (await req.json()) as TestFluxRequest
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { event, scenario, year } = body

  if (!event || !scenario || year === undefined || year === null) {
    return NextResponse.json(
      { error: "event, scenario, and year are required" },
      { status: 400 }
    )
  }

  const prompt = buildFluxPrompt(event, scenario, year)
  const start = Date.now()

  const result = await generateScenarioImage(scenario, year, "cinematic", event)
  const generationTimeMs = Date.now() - start

  if (typeof result === "object" && "error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({
    imageUrl: result,
    prompt,
    generationTimeMs,
    model: "fal-ai/flux/schnell",
  } satisfies TestFluxResponse)
}
