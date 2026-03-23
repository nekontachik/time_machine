import "server-only";
import { fal } from "@fal-ai/client";
import { IMAGE_MODEL, IMAGE_TIMEOUT_MS, IMAGE_MAX_ATTEMPTS } from "@/constants";

/**
 * Image generation via fal.ai (Flux 1 Schnell).
 */

fal.config({ credentials: process.env.FAL_KEY });

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

export function buildFluxPrompt(
  event: string,
  scenario: string,
  year: number
): string {
  const era = year < 0 ? `${Math.abs(year)} BC` : `${year} AD`;
  return [
    `Cinematic historical scene, ${era}.`,
    `Alternative timeline: ${scenario}.`,
    `Key element: ${event}.`,
    `Style: dramatic oil painting meets photorealism,`,
    `cinematic lighting, epic scale, highly detailed,`,
    `16:9 aspect ratio, no text, no watermarks.`,
  ].join(" ");
}

// ---------------------------------------------------------------------------
// Fallback placeholder selection
// ---------------------------------------------------------------------------

function getPlaceholderUrl(year: number): string {
  if (year < 500) return "/placeholder-ancient.jpg";
  if (year <= 1900) return "/placeholder-modern.jpg";
  return "/placeholder-future.jpg";
}

// ---------------------------------------------------------------------------
// Single Flux call with timeout
// ---------------------------------------------------------------------------

async function callFlux(prompt: string): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("fal.ai timeout")), IMAGE_TIMEOUT_MS)
  );

  const falPromise = fal.subscribe(IMAGE_MODEL, {
    input: {
      prompt,
      image_size: "landscape_16_9",
      num_images: 1,
    },
  });

  const result = await Promise.race([falPromise, timeoutPromise]);

  console.log(
    "[flux] response images:",
    (result as { data: { images: { url: string }[] } }).data?.images?.length
  );

  const imageUrl = (result as { data: { images: { url: string }[] } }).data
    ?.images?.[0]?.url;
  if (!imageUrl) throw new Error("No image returned from fal.ai");

  return imageUrl;
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
  const prompt = event
    ? buildFluxPrompt(event, scenarioSummary, year)
    : buildFluxPrompt(scenarioSummary, scenarioSummary, year);

  let lastError: unknown;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    try {
      return await callFlux(prompt);
    } catch (err) {
      lastError = err;
      console.warn(
        `[flux] attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} failed:`,
        (err as Error).message
      );
    }
  }

  console.error(
    "[flux] all attempts failed, returning placeholder. Last error:",
    lastError
  );
  return getPlaceholderUrl(year);
}
