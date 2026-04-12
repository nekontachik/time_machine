/**
 * AI Output Evaluation Harness
 *
 * Evaluates quality of AI-generated historical events and scenarios.
 * Run: npx tsx scripts/eval-harness.ts
 *
 * Requires: OPENROUTER_API_KEY in .env.local
 *
 * Checks:
 * 1. Event accuracy — do generated events match known historical facts?
 * 2. Response quality — latency, token count, structure compliance
 * 3. Hallucination detection — are generated events real?
 * 4. Provider comparison — Claude vs Gemini for scenario quality
 */

import dotenv from "dotenv";
import path from "path";

// Load .env.local (Next.js convention) with fallback to .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY not set. Copy .env.local.example to .env.local and fill in your key.");
  process.exit(1);
}

const OPENROUTER_BASE = "https://openrouter.ai/api/v1/chat/completions";

const EVAL_YEARS = [
  { year: 1969, mustInclude: ["moon", "apollo", "armstrong", "nixon"] },
  { year: 1945, mustInclude: ["war", "atomic", "hiroshima", "nazi", "surrender"] },
  { year: 1492, mustInclude: ["columbus", "america", "spain", "voyage"] },
  { year: 1789, mustInclude: ["french", "revolution", "bastille", "louis"] },
  { year: 1066, mustInclude: ["william", "norman", "hastings", "england"] },
  { year: -44, mustInclude: ["caesar", "rome", "assassination", "ides"] },
  { year: 1776, mustInclude: ["independence", "america", "declaration", "jefferson"] },
  { year: 1989, mustInclude: ["berlin", "wall", "tiananmen", "cold war"] },
  { year: 1914, mustInclude: ["war", "ferdinand", "sarajevo", "austria"] },
  { year: 2001, mustInclude: ["september", "twin", "terror", "afghanistan"] },
];

const GEMINI_MODEL = "google/gemini-2.0-flash-001";
const CLAUDE_MODEL = "anthropic/claude-sonnet-4-5";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EvalResult {
  year: number;
  model: string;
  latencyMs: number;
  tokenCount: number;
  events: string[];
  accuracyScore: number; // 0-1: fraction of mustInclude keywords found
  structureValid: boolean; // parsed as valid JSON array
  hallucinations: string[]; // events that didn't match any keyword
}

interface ScenarioEvalResult {
  year: number;
  model: string;
  latencyMs: number;
  charCount: number;
  paragraphCount: number;
  structureValid: boolean; // exactly 3 paragraphs
  readabilityScore: number; // avg words per sentence (lower = simpler)
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function callOpenRouter(
  model: string,
  messages: { role: string; content: string }[],
  maxTokens: number
): Promise<{ text: string; latencyMs: number; totalTokens: number }> {
  const start = Date.now();

  const response = await fetch(OPENROUTER_BASE, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages,
    }),
  });

  const latencyMs = Date.now() - start;

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${error}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content ?? "";
  const totalTokens = data.usage?.total_tokens ?? 0;

  return { text, latencyMs, totalTokens };
}

// ---------------------------------------------------------------------------
// Event evaluation
// ---------------------------------------------------------------------------

async function evalEvents(year: number, mustInclude: string[]): Promise<EvalResult> {
  const yearLabel = year < 0 ? `${Math.abs(year)} BCE` : year.toString();

  const { text, latencyMs, totalTokens } = await callOpenRouter(
    GEMINI_MODEL,
    [
      {
        role: "system",
        content: "You are a meticulous historian. Return only valid JSON, no markdown.",
      },
      {
        role: "user",
        content: `Return a JSON array of exactly 3 key events from the year ${yearLabel}.
Format: [{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]`,
      },
    ],
    512
  );

  let events: string[] = [];
  let structureValid = false;

  try {
    const clean = text.replace(/```json\n?|\n?```/g, "").trim();
    const parsed = JSON.parse(clean);
    if (Array.isArray(parsed)) {
      structureValid = true;
      events = parsed.map((e: { title?: string; description?: string }) =>
        `${e.title ?? ""} ${e.description ?? ""}`.toLowerCase()
      );
    }
  } catch {
    // structureValid stays false
  }

  const allText = events.join(" ");
  const matchedKeywords = mustInclude.filter((kw) => allText.includes(kw.toLowerCase()));
  const accuracyScore = matchedKeywords.length / mustInclude.length;

  const hallucinations = events.filter((eventText) => {
    return !mustInclude.some((kw) => eventText.includes(kw.toLowerCase()));
  });

  return {
    year,
    model: GEMINI_MODEL,
    latencyMs,
    tokenCount: totalTokens,
    events: events.map((e) => e.slice(0, 80)),
    accuracyScore,
    structureValid,
    hallucinations: hallucinations.map((h) => h.slice(0, 60)),
  };
}

// ---------------------------------------------------------------------------
// Scenario evaluation
// ---------------------------------------------------------------------------

async function evalScenario(
  year: number,
  model: string,
  changes: string
): Promise<ScenarioEvalResult> {
  const { text, latencyMs } = await callOpenRouter(
    model,
    [
      {
        role: "system",
        content:
          "You are a literary alternative history writer. Write with cinematic specificity.",
      },
      {
        role: "user",
        content: `Year: ${year}. Changed events: ${changes}.
Write an alternative history in exactly 3 paragraphs. Start immediately, no headers.`,
      },
    ],
    2048
  );

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const totalWords = text.split(/\s+/).length;
  const readabilityScore = sentences.length > 0 ? totalWords / sentences.length : 0;

  return {
    year,
    model,
    latencyMs,
    charCount: text.length,
    paragraphCount: paragraphs.length,
    structureValid: paragraphs.length === 3,
    readabilityScore: Math.round(readabilityScore * 10) / 10,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log("=== Time Machine AI Evaluation Harness ===\n");
  console.log(`Testing ${EVAL_YEARS.length} years for event accuracy...\n`);

  // --- Event evaluation ---
  const eventResults: EvalResult[] = [];

  for (const { year, mustInclude } of EVAL_YEARS) {
    try {
      const result = await evalEvents(year, mustInclude);
      eventResults.push(result);
      const emoji = result.accuracyScore >= 0.5 ? "✅" : "⚠️";
      console.log(
        `${emoji} Year ${year}: accuracy=${(result.accuracyScore * 100).toFixed(0)}% ` +
          `structure=${result.structureValid ? "OK" : "FAIL"} ` +
          `latency=${result.latencyMs}ms tokens=${result.tokenCount}`
      );
    } catch (err) {
      console.error(`❌ Year ${year}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // --- Summary ---
  const avgAccuracy =
    eventResults.reduce((sum, r) => sum + r.accuracyScore, 0) / eventResults.length;
  const avgLatency =
    eventResults.reduce((sum, r) => sum + r.latencyMs, 0) / eventResults.length;
  const structureFailures = eventResults.filter((r) => !r.structureValid).length;

  console.log("\n--- Event Evaluation Summary ---");
  console.log(`Average accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(`Average latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`Structure failures: ${structureFailures}/${eventResults.length}`);

  // --- Scenario comparison (Claude vs Gemini) ---
  console.log("\n=== Scenario Provider Comparison ===\n");
  const testYear = 1969;
  const testChanges = "Apollo 11 mission fails, astronauts do not land on the Moon";

  const scenarioResults: ScenarioEvalResult[] = [];

  for (const model of [CLAUDE_MODEL, GEMINI_MODEL]) {
    try {
      const result = await evalScenario(testYear, model, testChanges);
      scenarioResults.push(result);
      console.log(
        `${result.structureValid ? "✅" : "⚠️"} ${model}: ` +
          `paragraphs=${result.paragraphCount} chars=${result.charCount} ` +
          `readability=${result.readabilityScore} words/sentence ` +
          `latency=${result.latencyMs}ms`
      );
    } catch (err) {
      console.error(`❌ ${model}: ${err instanceof Error ? err.message : err}`);
    }
  }

  // --- Final report ---
  console.log("\n--- Final Report ---");
  console.log(`Events tested: ${eventResults.length}/${EVAL_YEARS.length}`);
  console.log(`Average event accuracy: ${(avgAccuracy * 100).toFixed(1)}%`);
  console.log(
    `Hallucination rate: ${(
      (eventResults.filter((r) => r.hallucinations.length > 0).length /
        eventResults.length) *
      100
    ).toFixed(0)}% of years had at least one unverified event`
  );
  console.log(
    `Scenario providers compared: ${scenarioResults.length} (year ${testYear})`
  );

  // Exit with error if accuracy is below threshold
  if (avgAccuracy < 0.4) {
    console.error("\n❌ FAIL: Average accuracy below 40% threshold");
    process.exit(1);
  }

  console.log("\n✅ Evaluation passed");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
