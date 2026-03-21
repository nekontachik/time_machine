import OpenAI from "openai";
import type { HistoricalEvent } from "@/types";

const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});

const EVENTS_MODEL = "google/gemini-2.0-flash-001";
const SCENARIO_MODEL = "anthropic/claude-sonnet-4-5";

export async function generateEvents(
  year: number,
  lang: string
): Promise<HistoricalEvent[]> {
  const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : year.toString();

  const response = await client.chat.completions.create({
    model: EVENTS_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `You are a historian. Return ONLY valid JSON array of 5 key events for year ${yearLabel}.
Format: [{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]
Language: ${lang}. No markdown, no preamble.`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error("Empty response from model");

  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean) as HistoricalEvent[];
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
        role: "user",
        content: `You are an alternative history writer. Given year ${year} and these changes: ${changes},
write a vivid 3-paragraph alternative history scenario in ${lang}.${localContext}
Write in engaging narrative style. Start immediately, no preamble.`,
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
