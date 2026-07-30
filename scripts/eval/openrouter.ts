/**
 * Minimal OpenRouter client for the harness. Uses global fetch (Node 18+), so
 * the harness has no runtime dependency beyond tsx + dotenv. It sends the exact
 * PromptSpec produced by lib/ai/prompts.ts, so the requests match production.
 */
import type { PromptSpec } from "@/lib/ai/prompts";

const BASE = "https://openrouter.ai/api/v1/chat/completions";

export interface CallResult {
  text: string;
  latencyMs: number;
  totalTokens: number;
}

export async function callOpenRouter(spec: PromptSpec): Promise<CallResult> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error("OPENROUTER_API_KEY not set");

  const start = Date.now();
  const res = await fetch(BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: spec.model,
      max_tokens: spec.maxTokens,
      messages: spec.messages,
    }),
  });
  const latencyMs = Date.now() - start;

  if (!res.ok) {
    throw new Error(`OpenRouter ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { total_tokens?: number };
  };
  return {
    text: data.choices?.[0]?.message?.content ?? "",
    latencyMs,
    totalTokens: data.usage?.total_tokens ?? 0,
  };
}
