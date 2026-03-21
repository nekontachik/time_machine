// TODO: REMOVE OR PROTECT THIS ENDPOINT BEFORE GOING TO PRODUCTION.
// It is intentionally unauthenticated and rate-unlimited for local development
// use only. Add an env-guard or move behind auth before deploying.

import { NextRequest, NextResponse } from "next/server"
import { buildFluxPrompt, generateScenarioImage } from "@/lib/openai"

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

  const imageUrl = await generateScenarioImage(scenario, year, "cinematic", event)

  const generationTimeMs = Date.now() - start

  return NextResponse.json({
    imageUrl,
    prompt,
    generationTimeMs,
    model: "black-forest-labs/flux-1-schnell",
  } satisfies TestFluxResponse)
}
