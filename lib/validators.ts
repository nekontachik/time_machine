import "server-only";
import { z } from "zod";
import { MIN_YEAR, MAX_YEAR } from "@/constants";

/**
 * Centralised request-body validators.
 *
 * All schemas use .strict() so unknown fields are rejected — this
 * prevents prototype-pollution-style payloads and stops typos
 * from silently succeeding on the wire.
 *
 * Lang values are an enum (no free-form strings), which closes the
 * prompt-injection vector where `lang=ua\nIGNORE PREVIOUS...` would
 * land inside the LLM template.
 */

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const LangSchema = z.enum(["ua", "en", "es", "pt", "pl"]);

export const YearSchema = z.coerce
  .number()
  .int()
  .min(MIN_YEAR)
  .max(MAX_YEAR);

/** Single-line short text, used for free-form user notes. Newlines are
 *  collapsed to single spaces to avoid promp-template breakouts. */
export const ShortNoteSchema = z
  .string()
  .max(300)
  .transform((s) => s.replace(/[\r\n]+/g, " ").trim());

// ---------------------------------------------------------------------------
// Domain shapes
// ---------------------------------------------------------------------------

export const EventToggleSchema = z
  .object({
    id: z.string().max(50),
    happened: z.boolean(),
    title: z.string().max(200).optional(),
  })
  .strict();

export const ScenarioRequestSchema = z
  .object({
    year: YearSchema,
    events: z.array(EventToggleSchema).min(1).max(10),
    customText: ShortNoteSchema.optional(),
    lang: LangSchema,
    premium: z
      .object({
        country: z.string().max(60),
        city: z.string().max(60),
      })
      .strict()
      .optional(),
  })
  .strict();

export const ImageRequestSchema = z
  .object({
    scenarioSummary: z.string().min(10).max(2000),
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
