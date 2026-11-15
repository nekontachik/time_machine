import "server-only";
import { z } from "zod";
import {
  MIN_YEAR,
  MAX_YEAR,
  MAX_EVENTS,
  MAX_EVENT_TITLE_LEN,
  MAX_IMAGE_SUMMARY_LEN,
} from "@/constants";

/**
 * Centralised request-body validators.
 *
 * All schemas use .strict() so unknown fields are rejected — this
 * prevents prototype-pollution-style payloads and stops typos
 * from silently succeeding on the wire.
 *
 * Lang values are an enum (no free-form strings), which closes the
 * prompt-injection vector where `lang=en\nIGNORE PREVIOUS...` would
 * land inside the LLM template.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

/** The product ships in English only (see types/index.ts). Keeping this an
 *  enum rather than a literal means adding a locale is a one-word change and
 *  every call site stays validated. */
export const LangSchema = z.enum(["en"]);

/** Year as a JSON-body number (not coerced). Used by POST handlers. */
export const YearSchema = z
  .number()
  .int()
  .min(MIN_YEAR)
  .max(MAX_YEAR);

/** Year as a query-string parameter. Rejects null/empty, then parses
 *  as a base-10 integer. Use this in GET handlers. */
export const YearParamSchema = z
  .string()
  .min(1, "year is required")
  .regex(/^-?\d+$/, "year must be an integer")
  .transform((v) => parseInt(v, 10))
  .pipe(z.number().int().min(MIN_YEAR).max(MAX_YEAR));

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

export const EventToggleSchema = z
  .object({
    id: z.string().max(50),
    happened: z.boolean(),
    title: z.string().max(MAX_EVENT_TITLE_LEN).optional(),
  })
  .strict();

export const ScenarioRequestSchema = z
  .object({
    year: YearSchema,
    // An EMPTY array is valid: it is the legitimate "user changed nothing"
    // case, which buildChangesString turns into NO_CHANGES_SENTINEL so the
    // prompt can pick its own divergence instead of recapping real history
    // (the none-recap failure mode in TAXONOMY.md). MAX_EVENTS caps the
    // adversarial upper bound.
    events: z.array(EventToggleSchema).max(MAX_EVENTS),
    lang: LangSchema,
    // No `premium` field: there is no paywall behind it and the client never
    // sends it, so accepting it only gave anyone a free-text slot in the
    // prompt. .strict() now rejects it with 400.
  })
  .strict();

export const ImageRequestSchema = z
  .object({
    // The client sends at most the first 400 chars of the scenario; 500
    // leaves headroom without turning this into a free-form prompt box.
    scenarioSummary: z.string().min(10).max(MAX_IMAGE_SUMMARY_LEN),
    year: YearSchema,
    style: z.enum(["cinematic", "painterly", "sketch"]).optional(),
  })
  .strict();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: { error: string; details?: unknown } };

/**
 * Parse and JSON-decode a request body against a schema. Returns a
 * tagged union so callers can early-return without try/catch.
 */
export async function parseJsonBody<T>(
  req: Request,
  schema: z.ZodType<T>
): Promise<ValidationResult<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      status: 400,
      body: { error: "Invalid JSON" },
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      status: 400,
      body: {
        error: "Invalid request",
        details: parsed.error.flatten(),
      },
    };
  }

  return { ok: true, data: parsed.data };
}
