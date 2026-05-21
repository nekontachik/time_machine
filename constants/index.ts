// ---------------------------------------------------------------------------
// Year range
// ---------------------------------------------------------------------------

export const MIN_YEAR = -3000;
export const MAX_YEAR = 2024;

// ---------------------------------------------------------------------------
// AI model identifiers
// ---------------------------------------------------------------------------

/** OpenRouter model for fast historical event generation */
export const EVENTS_MODEL = "google/gemini-2.0-flash-001";

/** OpenRouter model for rich alternative-history scenario generation */
export const SCENARIO_MODEL = "anthropic/claude-sonnet-4-5";

/** fal.ai model for image generation */
export const IMAGE_MODEL = "fal-ai/flux/schnell";

// ---------------------------------------------------------------------------
// Cache / rate-limit
// ---------------------------------------------------------------------------

/** TTL for cached historical events (24 h) */
export const EVENTS_CACHE_TTL_SECONDS = 60 * 60 * 24;

/** Default free requests per day when RATE_LIMIT_FREE env is not set.
 *  Used as fallback for the scenario bucket. */
export const DEFAULT_RATE_LIMIT = 10;

/** Per-IP daily limits for each expensive AI endpoint.
 *  Override at runtime via env (RATE_LIMIT_SCENARIO, RATE_LIMIT_EVENTS,
 *  RATE_LIMIT_IMAGE) — see lib/infrastructure/rate-limit.ts. */
export const BUCKET_LIMITS = {
  scenario: 10,
  events: 30,
  image: 5,
} as const;

export type BucketName = keyof typeof BUCKET_LIMITS;

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

/** Timeout for a single fal.ai image request */
export const IMAGE_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for image generation */
export const IMAGE_MAX_ATTEMPTS = 2;
