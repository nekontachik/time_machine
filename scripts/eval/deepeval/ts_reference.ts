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
 *     --traces scripts/eval/out/traces.jsonl --limit 20 --live \
 *     > scripts/eval/deepeval/ts_verdicts.jsonl
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

const TRACES = val("--traces", "scripts/eval/out/traces.jsonl");
const LIMIT = parseInt(val("--limit", "20"), 10);
const LIVE = has("--live");

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

  const lines = readFileSync(TRACES, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .slice(0, LIMIT);

  for (const l of lines) {
    const t = JSON.parse(l) as { traceId: string; year: number; output: string };
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
