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
// fal.ai error classification
// ---------------------------------------------------------------------------

export class FalAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalAuthError";
  }
}

/**
 * fal.ai can throw plain objects, fetch Responses, or non-standard values.
 * Normalise everything into a proper Error so every catch block works reliably.
 */
function normalizeFalError(err: unknown): Error {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (
      msg.includes("401") ||
      msg.includes("402") ||
      msg.includes("403") ||
      msg.includes("unauthorized") ||
      msg.includes("forbidden") ||
      msg.includes("payment") ||
      msg.includes("billing") ||
      msg.includes("quota")
    ) {
      return new FalAuthError(err.message);
    }
    return err;
  }
  if (typeof err === "object" && err !== null) {
    const obj = err as Record<string, unknown>;
    const status = obj.status ?? obj.statusCode ?? obj.code;
    const detail =
      obj.message ?? obj.detail ?? obj.error ?? JSON.stringify(err);
    if (status === 401 || status === 402 || status === 403) {
      return new FalAuthError(String(detail));
    }
    return new Error(String(detail));
  }
  return new Error(String(err));
}

// ---------------------------------------------------------------------------
// Single Flux call with timeout
// ---------------------------------------------------------------------------

async function callFlux(prompt: string): Promise<string> {
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("fal.ai timeout")), IMAGE_TIMEOUT_MS)
  );

  let result: unknown;
  try {
    result = await Promise.race([
      fal.subscribe(IMAGE_MODEL, {
        input: {
          prompt,
          image_size: "landscape_16_9",
          num_images: 1,
        },
      }),
      timeoutPromise,
    ]);
  } catch (err) {
    // Re-throw as a normalised Error so catch blocks always get an Error instance
    throw normalizeFalError(err);
  }

  console.warn(
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
): Promise<string | { error: string; status: number }> {
  const prompt = event
    ? buildFluxPrompt(event, scenarioSummary, year)
    : buildFluxPrompt(scenarioSummary, scenarioSummary, year);

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= IMAGE_MAX_ATTEMPTS; attempt++) {
    try {
      return await callFlux(prompt);
    } catch (err) {
      const normalized = normalizeFalError(err);
      lastError = normalized;

      // Auth/billing errors won't be fixed by retrying — bail out immediately
      if (normalized instanceof FalAuthError) {
        console.error("[flux] auth/billing error, skipping retries:", normalized.message);
        return { error: "fal_auth", status: 402 };
      }

      console.warn(
        `[flux] attempt ${attempt}/${IMAGE_MAX_ATTEMPTS} failed:`,
        normalized.message
      );
    }
  }

  console.error(
    "[flux] all attempts failed, returning placeholder. Last error:",
    lastError?.message
  );
  return getPlaceholderUrl(year);
}
