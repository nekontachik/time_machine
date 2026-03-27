import "server-only";
import OpenAI from "openai";
import type { HistoricalEvent } from "@/types";
import { EVENTS_MODEL, SCENARIO_MODEL } from "@/constants";
import { searchEventContext } from "@/lib/tavily";
import { findWikipediaUrl } from "@/lib/ai/search";

/**
 * Text generation via OpenRouter.
 *
 * Uses OpenAI-compatible SDK pointed at OpenRouter's API endpoint.
 * - Historical events → fast Gemini Flash model
 * - Alternative history scenarios → Claude Sonnet (streaming)
 */

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function generateEventTitles(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : year.toString();

  const response = await client.chat.completions.create({
    model: EVENTS_MODEL,
    max_tokens: 512,
    messages: [
      {
        role: "system",
        content:
          "You are a meticulous historian and science communicator. Return only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: `Return a JSON array of exactly 3 key events from the year ${yearLabel}.
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
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");

  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean) as HistoricalEvent[];
}

export async function enrichEventWithContext(
  event: HistoricalEvent,
  tavilySnippets: string,
  lang: string
): Promise<string> {
  const response = await client.chat.completions.create({
    model: EVENTS_MODEL,
    max_tokens: 256,
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
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");
  return text.trim();
}

export async function generateEvents(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : year.toString();
  const raw = await generateEventTitles(year, lang);

  const events = await Promise.all(
    raw.map(async (e) => {
      const [tavilyResult, wikipediaUrl] = await Promise.all([
        searchEventContext(e.title, year),
        findWikipediaUrl(`${e.title} ${yearLabel}`).then((u) => u ?? undefined),
      ]);

      const description =
        tavilyResult.snippets.length > 0
          ? await enrichEventWithContext(e, tavilyResult.snippets.join("\n\n"), lang)
          : e.description;

      return {
        ...e,
        description,
        thumbnail: tavilyResult.imageUrl,
        sourceUrl: tavilyResult.sourceUrl,
        wikipediaUrl,
      };
    })
  );

  return events;
}

export async function streamScenario({
  year,
  changes,
  lang,
  premium,
}: {
  year: number;
  changes: string;
  lang: string;
  premium?: { country: string; city: string };
}): Promise<ReadableStream<Uint8Array>> {
  const localContext = premium
    ? ` Focus on impact on ${premium.city}, ${premium.country}.`
    : "";

  const stream = await client.chat.completions.create({
    model: SCENARIO_MODEL,
    max_tokens: 2048,
    stream: true,
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
  });

  const encoder = new TextEncoder();

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta?.content;
        if (delta) {
          controller.enqueue(encoder.encode(delta));
        }
      }
      controller.close();
    },
  });
}
