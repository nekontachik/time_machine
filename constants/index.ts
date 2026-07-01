// ---------------------------------------------------------------------------
// Year range
// ---------------------------------------------------------------------------

export const MIN_YEAR = -3000;
export const MAX_YEAR = 2024;

// ---------------------------------------------------------------------------
// AI model identifiers
// ---------------------------------------------------------------------------

/** OpenRouter model for fast historical event generation */
export const EVENTS_MODEL = "google/gemini-3.1-flash-lite";

/** OpenRouter model for rich alternative-history scenario generation */
export const SCENARIO_MODEL = "anthropic/claude-sonnet-4.6";

/** fal.ai model for image generation */
export const IMAGE_MODEL = "fal-ai/flux/schnell";

/** fal.ai model for image-to-video generation
 *  v2.5-turbo/standard: ~15–30 s per clip (vs v2/master 60–120 s)
 *  Same input/output schema — just faster and cheaper.
 */
export const VIDEO_MODEL = "fal-ai/kling-video/v2.5-turbo/standard/image-to-video";

// ---------------------------------------------------------------------------
// Cache / rate-limit
// ---------------------------------------------------------------------------

/** TTL for cached historical events (24 h) */
export const EVENTS_CACHE_TTL_SECONDS = 60 * 60 * 24;

/** Default free requests per day when RATE_LIMIT_FREE env is not set */
export const DEFAULT_RATE_LIMIT = 3;

// ---------------------------------------------------------------------------
// Image generation
// ---------------------------------------------------------------------------

/** Timeout for a single fal.ai image request */
export const IMAGE_TIMEOUT_MS = 30_000;

/** Maximum retry attempts for image generation */
export const IMAGE_MAX_ATTEMPTS = 2;
