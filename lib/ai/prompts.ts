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

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

export interface PromptSpec {
  model: string;
  maxTokens: number;
  messages: ChatMessage[];
}

/** Parse the model's event-titles JSON (strips markdown fences). Shared with the harness. */
export function parseEventTitles(text: string): HistoricalEvent[] {
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean) as HistoricalEvent[];
}

/** Human-readable year label: negative years become "N BCE". */
export function yearLabel(year: number): string {
  return year < 0 ? `${Math.abs(year)} BCE` : year.toString();
}

/** Prompt for generating the 3 key historical events of a year. */
export function eventTitlesPrompt(year: number, lang: string): PromptSpec {
  return {
    model: EVENTS_MODEL,
    maxTokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are a meticulous historian and science communicator. Return only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: `Return a JSON array of exactly 3 key events from the year ${yearLabel(
          year
        )}.
Rules:
- Cover diverse domains: politics, science/tech, culture, military, social/economic — not all the same type.
- Each description must be 2–3 sentences: what happened, why it mattered, what it changed.
- Include the specific date (month + day) when known, embedded naturally in the description.
- Impact: "high" = shaped a decade or more; "medium" = notable regional/global effect; "low" = culturally significant but limited direct consequence.
- Sort by impact descending.
- Output language: ${lang}.
Format: [{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]`,
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
        content: `Year: ${year}. Changed events: ${changes}.

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
