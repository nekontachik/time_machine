/**
 * Q1 (v2 iteration) — does prompt v2 recover event count on dense years WITHOUT
 * bringing wrong-year padding back on sparse years?
 *
 * Prompt-agnostic: candidates are inlined here, so this does NOT depend on what
 * is currently in lib/ai/prompts.ts. Only when v2 wins do we copy it into the file.
 *
 *   npx tsx --tsconfig scripts/eval/tsconfig.json scripts/eval/runQ1.ts [--runs N] [--limit N]
 *
 * v0 = original "exactly 3"     (baseline — pads with wrong-year events on sparse years)
 * v2 = "include every confident same-year event, up to 3; never pad with other years"
 *
 * Output: count table (v0 avg vs v2 avg, dense years first) + a dump of the v2
 * events per year so padding/correctness can be adjudicated by hand.
 */
import { mkdirSync, writeFileSync, appendFileSync } from "fs";
import { dirname } from "path";
import { TUPLES } from "./tuples";
import { callOpenRouter } from "./openrouter";
import {
  parseEventTitles,
  yearLabel,
  EVENT_TITLES_RESPONSE_FORMAT,
  type PromptSpec,
} from "@/lib/ai/prompts";
import type { HistoricalEvent } from "@/types";
import { EVENTS_MODEL } from "@/constants";

const argv = process.argv.slice(2);
const val = (f: string, d: string) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const RUNS = parseInt(val("--runs", "3"), 10);
const LIMIT = parseInt(val("--limit", String(TUPLES.length)), 10);
const OUT = val("--out", "scripts/eval/out/q1-v2-shift.md");
const LANG = "en";

const SYSTEM = "You are a meticulous historian and science communicator. Return only valid JSON, no markdown.";

function spec(userContent: string): PromptSpec {
  return {
    model: EVENTS_MODEL,
    maxTokens: 1024,
    responseFormat: EVENT_TITLES_RESPONSE_FORMAT,
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: userContent },
    ],
  };
}

/** v0 — ORIGINAL prompt (master): forced "exactly 3". */
function v0(year: number): string {
  return `Return exactly 3 key events from the year ${yearLabel(year)}.
Rules:
- Cover diverse domains: politics, science/tech, culture, military, social/economic — not all the same type.
- Each description must be 2–3 sentences: what happened, why it mattered, what it changed.
- Include the specific date (month + day) when known, embedded naturally in the description.
- Impact: "high" = shaped a decade or more; "medium" = notable regional/global effect; "low" = culturally significant but limited direct consequence.
- Sort by impact descending.
- Output language: ${LANG}.
Return a JSON object {"events":[{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]} with exactly 3 items.`;
}

/** v2 — recall-preserving fix: complete on rich years, never pad on sparse ones. */
function v2(year: number): string {
  return `Return up to 3 key events from the year ${yearLabel(year)}.

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
- Output language: ${LANG}.

Return a JSON object {"events":[{"id":"1","title":"...","description":"...","impact":"high|medium|low"}]} with up to 3 items, every one genuinely from ${yearLabel(year)}.`;
}

async function events(userContent: string): Promise<HistoricalEvent[]> {
  const { text } = await callOpenRouter(spec(userContent));
  return parseEventTitles(text);
}

async function main() {
  const dotenv = await import("dotenv");
  dotenv.config({ path: ".env.local" });
  dotenv.config({ path: ".env" });
  if (!process.env.OPENROUTER_API_KEY) {
    console.error("OPENROUTER_API_KEY not set. Fill .env.local.");
    process.exit(1);
  }

  const rank = (d: string) => (d === "high" ? 0 : d === "medium" ? 1 : 2);
  const tuples = TUPLES.slice(0, LIMIT).sort((a, b) => rank(a.density) - rank(b.density));

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(
    OUT,
    `# Q1 v2 — recall recovery check (v0 vs v2)\n\n` +
      `Model: ${EVENTS_MODEL} · runs/year: ${RUNS} · prompt-agnostic (candidates inlined).\n` +
      `Goal: v2 recovers count on DENSE years AND keeps sparse years padding-free.\n\n` +
      `| year | density | v0 counts | v2 counts | v0 avg | v2 avg |\n` +
      `|---|---|---|---|---|---|\n`
  );

  const details: string[] = [];
  let n = 0;
  const total = tuples.length * RUNS;
  for (const t of tuples) {
    const c0: number[] = [];
    const c2: number[] = [];
    details.push(`\n## ${yearLabel(t.year)} (${t.density}) — v2 events`);
    for (let r = 1; r <= RUNS; r++) {
      n++;
      process.stdout.write(`[${n}/${total}] ${yearLabel(t.year)} (${t.density}) r${r} … `);
      try {
        const e0 = await events(v0(t.year));
        const e2 = await events(v2(t.year));
        c0.push(e0.length);
        c2.push(e2.length);
        details.push(`- r${r} (${e2.length}): ` + e2.map((e) => `[${e.impact}] ${e.title}`).join(" · "));
        console.log(`v0 ${e0.length} / v2 ${e2.length}`);
      } catch (err) {
        console.log(`ERROR ${err instanceof Error ? err.message : err}`);
        details.push(`- r${r}: ERROR`);
      }
    }
    const avg = (xs: number[]) => (xs.length ? (xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(1) : "—");
    appendFileSync(
      OUT,
      `| ${yearLabel(t.year)} | ${t.density} | ${c0.join(",")} | ${c2.join(",")} | ${avg(c0)} | ${avg(c2)} |\n`
    );
  }

  appendFileSync(OUT, `\n# v2 events (adjudicate padding by hand)\n${details.join("\n")}\n`);
  console.log(`\n--- done --- ${n}/${total} year-runs -> ${OUT}`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
