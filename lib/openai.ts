import OpenAI from "openai";
import sharp from "sharp";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const IMAGE_MODEL = "black-forest-labs/flux.2-flex";

const TIMEOUT_MS = 30_000;
const MAX_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildFluxPrompt(event: string, scenario: string, year: number): string {
  const era = year < 0 ? `${Math.abs(year)} BC` : `${year} AD`
  return [
    `Cinematic historical scene, ${era}.`,
    `Alternative timeline: ${scenario}.`,
    `Key element: ${event}.`,
    `Style: dramatic oil painting meets photorealism,`,
    `cinematic lighting, epic scale, highly detailed,`,
    `16:9 aspect ratio, no text, no watermarks.`,
  ].join(" ")
}

// ---------------------------------------------------------------------------
// Fallback placeholder selection
// ---------------------------------------------------------------------------

function getPlaceholderUrl(year: number): string {
  if (year < 500) return "/placeholder-ancient.jpg"
  if (year <= 1900) return "/placeholder-modern.jpg"
  return "/placeholder-future.jpg"
}

// ---------------------------------------------------------------------------
// Single Flux call with AbortController timeout
// ---------------------------------------------------------------------------

async function callFlux(prompt: string): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  try {
    const response = await client.chat.completions.create(
      {
        model: IMAGE_MODEL,
        modalities: ["image"],
        messages: [{ role: "user", content: prompt }],
        image_config: { aspect_ratio: "16:9" },
      } as Parameters<typeof client.chat.completions.create>[0],
      { signal: controller.signal }
    )

    console.log("[flux] response", JSON.stringify(response, null, 2))

    const imageData = (response as unknown as { choices: { message: { images?: { image_url: { url: string } }[] } }[] })
      .choices?.[0]?.message?.images?.[0]?.image_url?.url
    if (imageData) {
      if (imageData.startsWith("data:image/")) {
        const base64 = imageData.replace(/^data:image\/\w+;base64,/, "")
        const buffer = Buffer.from(base64, "base64")
        const compressed = await sharp(buffer)
          .resize({ width: 640 })
          .webp({ quality: 80 })
          .toBuffer()
        return `data:image/webp;base64,${compressed.toString("base64")}`
      }
      return imageData
    }

    throw new Error("No image returned from OpenRouter")
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Public wrapper with retry + fallback
// ---------------------------------------------------------------------------

export async function generateScenarioImage(
  scenarioSummary: string,
  year: number,
  _style: string = "cinematic",
  event: string = ""
): Promise<string> {
  // Build an enriched prompt when an event is supplied; fall back to the
  // legacy single-string format when the caller only passes scenarioSummary.
  const prompt = event
    ? buildFluxPrompt(event, scenarioSummary, year)
    : buildFluxPrompt(scenarioSummary, scenarioSummary, year)

  let lastError: unknown

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await callFlux(prompt)
    } catch (err) {
      lastError = err
      console.warn(`[flux] attempt ${attempt}/${MAX_ATTEMPTS} failed:`, (err as Error).message)
    }
  }

  // All attempts exhausted — return era-appropriate placeholder
  console.error("[flux] all attempts failed, returning placeholder. Last error:", lastError)
  return getPlaceholderUrl(year)
}
