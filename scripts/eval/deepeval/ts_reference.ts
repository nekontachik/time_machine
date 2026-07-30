/**
 * TS reference for the DeepEval wrapper. Reuses the FROZEN judge code directly
 * (payoffJudge.ts + openrouter.ts) — no reimplementation — so it is the ground
 * truth for both parity checks.
 *
 * Emits one JSON line per trace: {traceId, year, present, model, maxTokens, messages}
 * and, with --live, also {verdict, reason}.
 *
 *   # prompt fixtures for byte-parity (OFFLINE, no network):
 *   node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \
 *     scripts/eval/deepeval/ts_reference.ts \
 *     --traces scripts/eval/out/none_fixed.jsonl --limit 5 \
 *     > scripts/eval/deepeval/prompt_fixtures.jsonl
 *
 *   # TS baseline verdicts for parity (LIVE, needs OPENROUTER_API_KEY):
 *   node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \
 *     scripts/eval/deepeval/ts_reference.ts \
 *     --traces scripts/eval/out/product_100.jsonl --limit 18 \
 *     --ids T15-r3,T18-r3 --live \
 *     > scripts/eval/deepeval/ts_verdicts.jsonl
 *
 * --ids pins specific traceIds into the slice. Parity must exercise BOTH
 * verdicts, and product_100.jsonl's only two same_world traces (T15-r3, T18-r3)
 * are not in the head of the file. See run_parity.py for the full rationale and
 * for why out/traces.jsonl is no longer usable here.
 */
import { readFileSync } from "fs";
import { callOpenRouter } from "../openrouter";
import { payoffJudgePrompt, presentDayBeat, parsePayoffVerdict } from "../judges/payoffJudge";

const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string, d: string) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};

const TRACES = val("--traces", "scripts/eval/out/product_100.jsonl");
const LIMIT = parseInt(val("--limit", "18"), 10);
const IDS = val("--ids", "T15-r3,T18-r3")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const LIVE = has("--live");

type Row = { traceId: string; year: number; output: string; dryRun?: boolean };

/** See run_parity.py:assert_not_stubs — out/traces.jsonl was overwritten with
 *  dry-run stubs on 2026-07-10 and is committed in that state. */
function assertNotStubs(rows: Row[]): void {
  const stubs = rows.filter((r) => r.dryRun === true || String(r.output ?? "").includes("[DRY-RUN"));
  if (stubs.length) {
    console.error(
      `${TRACES}: ${stubs.length}/${rows.length} traces are dry-run stubs (e.g. ${stubs[0].traceId}).\n` +
        `Parity/fixtures built from stub text are meaningless — use out/product_100.jsonl.`
    );
    process.exit(1);
  }
}

async function main() {
  if (LIVE) {
    const dotenv = await import("dotenv");
    // quiet: suppress dotenv's stdout banner, which would corrupt the JSONL output.
    dotenv.config({ path: ".env.local", quiet: true });
    dotenv.config({ path: ".env", quiet: true });
    if (!process.env.OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY not set (needed for --live). Fill .env.local.");
      process.exit(1);
    }
  }

  const all = readFileSync(TRACES, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Row);
  assertNotStubs(all);

  // pinned ids first, then fill from the top of the file (same order as run_parity.select)
  const byId = new Map(all.map((r) => [r.traceId, r]));
  const missing = IDS.filter((i) => !byId.has(i));
  if (missing.length) {
    console.error(`--ids not found in ${TRACES}: ${missing.join(", ")}`);
    process.exit(1);
  }
  const picked: Row[] = IDS.map((i) => byId.get(i)!);
  const seen = new Set(IDS);
  for (const r of all) {
    if (picked.length >= LIMIT + IDS.length) break;
    if (!seen.has(r.traceId)) {
      picked.push(r);
      seen.add(r.traceId);
    }
  }

  for (const t of picked) {
    const present = presentDayBeat(t.output);
    const spec = payoffJudgePrompt({ year: t.year, present });
    const rec: Record<string, unknown> = {
      traceId: t.traceId,
      year: t.year,
      present,
      model: spec.model,
      maxTokens: spec.maxTokens,
      messages: spec.messages,
    };
    if (LIVE) {
      const r = await callOpenRouter(spec);
      const p = parsePayoffVerdict(r.text);
      rec.verdict = p.verdict;
      rec.reason = p.reason;
    }
    console.log(JSON.stringify(rec));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
