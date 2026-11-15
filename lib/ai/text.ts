import "server-only";
import OpenAI from "openai";
import type { HistoricalEvent } from "@/types";
import { searchEventContext } from "@/lib/tavily";
import { findWikipediaUrl } from "@/lib/ai/search";
import {
  eventTitlesPrompt,
  enrichEventPrompt,
  scenarioPrompt,
  parseEventTitles,
  yearLabel,
} from "@/lib/ai/prompts";

/**
 * Text generation via OpenRouter.
 *
 * Uses OpenAI-compatible SDK pointed at OpenRouter's API endpoint.
 * - Historical events → fast Gemini Flash model
 * - Alternative history scenarios → Claude Sonnet (streaming)
 *
 * Prompts live in lib/ai/prompts.ts (shared with the eval harness).
 */

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

export async function generateEventTitles(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const spec = eventTitlesPrompt(year, lang);

  const response = await client.chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    messages: spec.messages,
    response_format: spec.responseFormat as any,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");

  return parseEventTitles(text);
}

export async function enrichEventWithContext(
  event: HistoricalEvent,
  tavilySnippets: string,
  lang: string
): Promise<string> {
  const spec = enrichEventPrompt(event, tavilySnippets, lang);

  const response = await client.chat.completions.create({
    model: spec.model,
    max_tokens: spec.maxTokens,
    messages: spec.messages,
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");
  return text.trim();
}

export async function generateEvents(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const raw = await generateEventTitles(year, lang);

  const events = await Promise.all(
    raw.map(async (e) => {
      const [tavilyResult, wikipediaUrl] = await Promise.all([
        searchEventContext(e.title, year),
        findWikipediaUrl(`${e.title} ${yearLabel(year)}`).then((u) => u ?? undefined),
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
  const spec = scenarioPrompt({
    year,
    changes,
    lang,
    premium,
    canary: process.env.REDTEAM_CANARY, // red-team only; undefined in prod
  });

  // Aborting this cancels the upstream OpenRouter request, so a client that
  // disconnects mid-scenario stops the generation (and the billing) instead
  // of letting it run to max_tokens for nobody.
  const upstream = new AbortController();

  const stream = await client.chat.completions.create(
    {
      model: spec.model,
      max_tokens: spec.maxTokens,
      stream: true,
      messages: spec.messages,
    },
    { signal: upstream.signal }
  );

  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (cancelled) break;
          const delta = chunk.choices[0]?.delta?.content;
          if (delta) {
            controller.enqueue(encoder.encode(delta));
          }
        }
        if (!cancelled) controller.close();
      } catch (err) {
        // After cancel() the abort surfaces here as an error; the consumer
        // is already gone, so there is nothing to report.
        if (cancelled) return;
        console.error("[scenario] upstream stream failed:", err);
        // Error the stream so the client's reader rejects instead of
        // waiting forever on a stream that will never close.
        controller.error(new Error("Scenario generation failed"));
      }
    },
    cancel() {
      cancelled = true;
      upstream.abort();
    },
  });
}
