/**
 * Pure prompt builders — the single source of truth for the prompts used by
 * both the production code (lib/ai/text.ts) and the eval harness
 * (scripts/eval/*). No "server-only" import, no side effects, no I/O — just
 * functions that turn inputs into model request specs.
 *
 * Why this file exists: the eval harness must send the EXACT same prompts the
 * product sends, otherwise the traces it produces are not representative.
 * Keeping the prompt text here (and importing it from text.ts) guarantees zero
 * drift between "what we evaluate" and "what we ship".
 */
import type { HistoricalEvent } from "@/types";
import { EVENTS_MODEL, SCENARIO_MODEL } from "@/constants";
import { NO_CHANGES_SENTINEL } from "@/lib/ai/changes";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface PromptSpec {
  model: string;
  maxTokens: number;
  messages: ChatMessage[];
  /** Optional OpenRouter/OpenAI response_format (e.g. json_schema structured output). */
  responseFormat?: unknown;
}

/**
 * Structured-output schema for event generation. Forcing a json_schema
 * response makes it impossible for the model to return malformed/truncated
 * JSON. The array is wrapped in an object because structured outputs require
 * an object at the schema root.
 */
export const EVENT_TITLES_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "historical_events",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["events"],
      properties: {
        events: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["id", "title", "description", "impact"],
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              impact: { type: "string", enum: ["high", "medium", "low"] },
            },
          },
        },
      },
    },
  },
} as const;

/** Parse the model's event-titles JSON. Tolerant of both a bare array and the
 *  structured-output {events:[...]} object. Shared with the harness. */
export function parseEventTitles(text: string): HistoricalEvent[] {
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(clean);
  const events = Array.isArray(parsed) ? parsed : parsed?.events;
  if (!Array.isArray(events)) throw new Error("Model returned no events array");
  return events as HistoricalEvent[];
}

/** Human-readable year label: negative years become "N BCE". */
export function yearLabel(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : year.toString();
}

/** Prompt for generating 1–3 key historical events of a year.
 *  Year-accuracy is a hard constraint: include every event confidently from the
 *  target year (prefer 3 on rich years), but never pad with events from other
 *  years — return fewer on genuinely sparse years. v2 wording recovers the
 *  dense-year recall the earlier phrasing cost (see fix-01-recall-regression.md). */
export function eventTitlesPrompt(year: number, lang: string): PromptSpec {
  return {
    model: EVENTS_MODEL,
    maxTokens: 1024,
    responseFormat: EVENT_TITLES_RESPONSE_FORMAT,
    messages: [
      {
        role: "system",
        content:
          "You are a meticulous historian and science communicator. Return only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: `Return up to 3 key events from the year ${yearLabel(year)}.

Year accuracy is the one hard rule:
- Include ONLY events that actually occurred in ${yearLabel(year)}.
- Include EVERY event you are confident happened in ${yearLabel(year)}, up to a maximum of 3 — do NOT withhold correct events, and prefer 3 when three genuine ${yearLabel(year)} events exist.
- NEVER add an event from a different year to reach three. If fewer than 3 notable events occurred in ${yearLabel(year)}, return only those.
- If you are unsure whether an event happened in exactly ${yearLabel(year)}, leave it out.

Other rules (never at the expense of the hard rule):
- Cover diverse domains (politics, science/tech, culture, military, social/economic) when several genuine same-year events exist.
- Each description: 2–3 sentences — what happened, why it mattered, what it changed.
- Include a specific month/day ONLY when it is actually known for that event; never invent precision. For deep antiquity where exact dating is impossible, state the timing approximately (e.g., "around this time") rather than a false exact date.
- Impact: "high" = shaped a decade or more; "medium" = notable regional/global effect; "low" = limited direct consequence.
- Sort by impact descending.
- Output language: ${lang}.

Return a JSON object {"events":[{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]} with up to 3 items, every one genuinely from ${yearLabel(year)}.`,
      },
    ],
  };
}

/** Prompt for rewriting one event description from real source snippets. */
export function enrichEventPrompt(
  event: HistoricalEvent,
  tavilySnippets: string,
  lang: string
): PromptSpec {
  return {
    model: EVENTS_MODEL,
    maxTokens: 256,
    messages: [
      {
        role: "system",
        content: "You are a precise historian. Write only what sources confirm.",
      },
      {
        role: "user",
        content: `Event: ${event.title}
Real source snippets: ${tavilySnippets}
Write a factual 2-sentence description in language: ${lang}.
Include the specific date if found in snippets. No speculation.`,
      },
    ],
  };
}

/** Prompt for the 3-paragraph alternative-history scenario. */
export function scenarioPrompt({
  year,
  changes,
  lang,
  premium,
}: {
  year: number;
  changes: string;
  lang: string;
  premium?: { country: string; city: string };
}): PromptSpec {
  const localContext = premium
    ? ` Focus on impact on ${premium.city}, ${premium.country}.`
    : "";

  // When the user changed nothing, "Changed events: all events happened as
  // recorded" + "write an alternative history" is a contradiction that makes the
  // model recap real history (TAXONOMY.md: none-recap — the #1 failure mode).
  // Resolve it by instructing the model to pick its own divergence. The branch
  // for actual changes is kept byte-identical to the original prompt.
  const divergence =
    changes.trim() === NO_CHANGES_SENTINEL
      ? `No event was removed. Choose the single most consequential event of ${yearLabel(
          year
        )} yourself and write the timeline in which it unfolded differently. Do NOT retell real history — this must be a genuine counterfactual.`
      : `Changed events: ${changes}.`;

  return {
    model: SCENARIO_MODEL,
    maxTokens: 2048,
    messages: [
      {
        role: "system",
        content:
          "You are a literary alternative history writer in the tradition of Robert Cowley and Harry Turtledove. Write with cinematic specificity: real names, exact dates, concrete places.",
      },
      {
        role: "user",
        content: `Year: ${year}. ${divergence}

Write an alternative history in exactly 3 paragraphs. Output language: ${lang}.

Paragraph 1 — The Divergence (immediate, weeks to months after the change):
Describe the precise moment the timeline splits. Name specific people, institutions, and places. Show the first concrete consequence that nobody expected.

Paragraph 2 — The Cascade (1–20 years later):
Follow the butterfly effect. What alliances shift? Which technologies accelerate or stall? Name a city that rose or fell, a leader who gained power or was never born, a war that did or didn't happen.

Paragraph 3 — The World Today (present day, 2025 in this timeline):
Describe how the world looks now. What does the average person's life feel like? What exists that doesn't in our timeline — or what is missing that we take for granted?${localContext} End with one haunting detail.

Start immediately with Paragraph 1. No preamble, no headers, no markdown.`,
      },
    ],
  };
}
