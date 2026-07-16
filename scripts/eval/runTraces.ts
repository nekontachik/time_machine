/**
 * Trace runner — produces ~100 real product traces for error analysis.
 *
 *   npx tsx --tsconfig scripts/eval/tsconfig.json scripts/eval/runTraces.ts [flags]
 *
 * Flags:
 *   --dry-run        no network, no API key — stub events + synthetic output.
 *                    Use this to validate the pipeline + coverage for free.
 *                    Writes to scripts/eval/out/dryrun/ — NEVER to live paths.
 *   --runs N         runs per tuple (default 5 -> 20 tuples x 5 = 100 traces).
 *   --limit N        only the first N tuples (smoke test).
 *   --complexity C   only tuples of complexity C (none|peripheral|central|compound).
 *   --out PATH       output JSONL (default: date-stamped, see below).
 *   --force          allow overwriting an existing output file.
 *
 * Run artifacts are APPEND-ONLY (lesson of the 2026-07-10 incident, when a
 * dry-run rerun silently overwrote the labelled calibration traces):
 *   - default output is date-stamped:  out/traces-YYYY-MM-DD.jsonl
 *   - dry-run goes to a separate dir:  out/dryrun/traces-YYYY-MM-DD-dry.jsonl
 *   - refuses to overwrite an existing file unless --force is passed.
 *
 * Pipeline per run (faithful to the product):
 *   real events  = generateEventTitles(year, lang)        [prompts.ts + parse]
 *   toggles      = selectDisabled(events, complexity)     [dimensions.ts]
 *   changes      = buildChangesString(toggles)             [changes.ts = API route]
 *   output       = scenario model on scenarioPrompt(...)  [prompts.ts]
 *
 * Note: production streams the scenario (stream:true); the harness calls the
 * same model/prompt/max_tokens non-streamed to capture the full text + usage.
 * Same content, simpler capture.
 */
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from "fs";
import { dirname } from "path";
import type { HistoricalEvent, Lang } from "@/types";
import {
  eventTitlesPrompt,
  scenarioPrompt,
  parseEventTitles,
  yearLabel,
} from "@/lib/ai/prompts";
import { buildChangesString } from "@/lib/ai/changes";
import { SCENARIO_MODEL } from "@/constants";
import { TUPLES, coverageReport } from "./tuples";
import {
  selectDisabled,
  assertSeparable,
  PRODUCT_LANG,
} from "./dimensions";
import { callOpenRouter } from "./openrouter";

// --- flags -----------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string, d: string) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const DRY = has("--dry-run");
const FORCE = has("--force");
const RUNS = parseInt(val("--runs", "5"), 10);
const LIMIT = parseInt(val("--limit", String(TUPLES.length)), 10);
const STAMP = new Date().toISOString().slice(0, 10);
const DEFAULT_OUT = DRY
  ? `scripts/eval/out/dryrun/traces-${STAMP}-dry.jsonl`
  : `scripts/eval/out/traces-${STAMP}.jsonl`;
const OUT = val("--out", DEFAULT_OUT);
const COMPLEXITY = val("--complexity", ""); // none|peripheral|central|compound; "" = all

// append-only guard: a run must never silently destroy a previous artifact
if (existsSync(OUT) && !FORCE) {
  console.error(
    `refusing to overwrite existing ${OUT} — run artifacts are append-only.\n` +
      `Use --out for a new path, or --force to overwrite deliberately.`
  );
  process.exit(1);
}

// --- dry-run stubs ---------------------------------------------------------
function stubEvents(year: number): HistoricalEvent[] {
  const L = yearLabel(year);
  return [
    { id: "1", title: `High-impact event of ${L}`, description: "stub", impact: "high" },
    { id: "2", title: `Medium-impact event of ${L}`, description: "stub", impact: "medium" },
    { id: "3", title: `Low-impact event of ${L}`, description: "stub", impact: "low" },
  ];
}
function stubScenario(year: number, changes: string, lang: string): string {
  return [
    `[DRY-RUN ${lang}] Paragraph 1 — Divergence at ${yearLabel(year)}. Changes: ${changes}.`,
    `Paragraph 2 — Cascade over the following decades.`,
    `Paragraph 3 — The world in 2025 of this timeline. One haunting detail.`,
  ].join("\n\n");
}

async function getEvents(year: number, lang: Lang): Promise<HistoricalEvent[]> {
  if (DRY) return stubEvents(year);
  const { text } = await callOpenRouter(eventTitlesPrompt(year, lang));
  return parseEventTitles(text);
}

async function main() {
  if (!DRY) {
    const dotenv = await import("dotenv");
    dotenv.config({ path: ".env.local" });
    dotenv.config({ path: ".env" });
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY not set. Use --dry-run, or fill .env.local.");
      process.exit(1);
    }
  }

  console.log("=== Time Machine — Trace Harness ===");
  console.log(DRY ? "(dry-run: no network)\n" : "(live)\n");
  console.log(coverageReport());

  const tuples = TUPLES.slice(0, LIMIT).filter(
    (t) => !COMPLEXITY || t.complexity === COMPLEXITY
  );
  const total = tuples.length * RUNS;
  console.log(
    `\nplan: ${tuples.length} tuples${COMPLEXITY ? ` (complexity=${COMPLEXITY})` : ""} ` +
      `x ${RUNS} runs = ${total} traces -> ${OUT}\n`
  );

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, "");
  let n = 0;
  let collapsed = 0;
  const latencies: number[] = [];

  for (const t of tuples) {
    for (let run = 1; run <= RUNS; run++) {
      const idx = n + 1;
      const t0 = Date.now();
      process.stdout.write(`[${idx}/${total}] ${t.id} r${run} (${t.complexity}) generating… `);
      try {
        const events = await getEvents(t.year, PRODUCT_LANG);
        const sep = assertSeparable(events, t.complexity);
        if (!sep.ok) collapsed++;

        const { toggles, disabledIds } = selectDisabled(events, t.complexity);
        const changes = buildChangesString(toggles);

        let output: string;
        let latencyMs = 0;
        let totalTokens = 0;
        if (DRY) {
          output = stubScenario(t.year, changes, PRODUCT_LANG);
        } else {
          const r = await callOpenRouter(
            scenarioPrompt({ year: t.year, changes, lang: PRODUCT_LANG })
          );
          output = r.text;
          latencyMs = r.latencyMs;
          totalTokens = r.totalTokens;
          latencies.push(latencyMs);
        }

        const paragraphCount = output
          .split(/\n\n+/)
          .map((p) => p.trim())
          .filter(Boolean).length;

        const trace = {
          traceId: `${t.id}-r${run}`,
          tupleId: t.id,
          run,
          ts: new Date().toISOString(),
          dryRun: DRY,
          dims: { era: t.era, density: t.density, complexity: t.complexity, lang: PRODUCT_LANG },
          hypothesis: t.hypothesis,
          year: t.year,
          lang: PRODUCT_LANG,
          events: events.map((e) => ({ id: e.id, title: e.title, impact: e.impact })),
          disabledIds,
          separable: sep,
          changes,
          scenarioModel: SCENARIO_MODEL,
          latencyMs,
          totalTokens,
          paragraphCount,
          output,
        };

        appendFileSync(OUT, JSON.stringify(trace) + "\n");
        n++;
        console.log(
          `done ${Date.now() - t0}ms · paras=${paragraphCount}${sep.ok ? "" : " ⚠ COLLAPSED"} · saved ${n}/${total}`
        );
      } catch (err) {
        console.error(`\n!! ${t.id} r${run}: ${err instanceof Error ? err.message : err}`);
      }
    }
  }

  console.log(`\n\n--- done ---`);
  console.log(`traces written: ${n} -> ${OUT}`);
  console.log(`complexity-axis collapses (3 events, 1 tier): ${collapsed}`);
  if (latencies.length) {
    const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    console.log(`avg scenario latency: ${avg.toFixed(0)}ms`);
  }
  console.log(`\nNext: open ${OUT} and start open coding (one free-text note per trace).`);
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
