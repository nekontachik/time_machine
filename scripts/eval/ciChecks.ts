/**
 * Deterministic eval-data integrity checks — CI tier 1 (no network, no keys).
 *
 *   npx tsx --tsconfig scripts/eval/tsconfig.json scripts/eval/ciChecks.ts
 *
 * Guards the committed reference artifacts that judge calibration and the
 * product baseline depend on. Direct lesson of the 2026-07-10 incident, when
 * a dry-run rerun silently replaced labelled traces with stubs: had these
 * checks existed, the corruption would have failed CI the same day.
 *
 * Checks:
 *   1. product_100.jsonl — baseline run: 100 real traces, schema, dims split
 *   2. evals1/payoff-review.md — gold set: 100 labels, 13 fail
 *   3. real-trace files contain no dry-run stubs
 */
import { readFileSync } from "fs";

let failed = 0;
function check(name: string, ok: boolean, detail = ""): void {
  console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failed++;
}

function loadJsonl(path: string): Record<string, unknown>[] {
  return readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Record<string, unknown>);
}

// --- 1. baseline run: product_100.jsonl ------------------------------------
const BASELINE = "scripts/eval/out/product_100.jsonl";
const REQUIRED = [
  "traceId", "tupleId", "run", "ts", "dims", "year", "lang",
  "events", "disabledIds", "changes", "scenarioModel",
  "latencyMs", "totalTokens", "output",
];
const recs = loadJsonl(BASELINE);

check(`${BASELINE}: 100 traces`, recs.length === 100, `got ${recs.length}`);
check(
  `${BASELINE}: unique traceIds`,
  new Set(recs.map((r) => r.traceId)).size === recs.length
);
check(
  `${BASELINE}: no dry-run records`,
  recs.every((r) => !r.dryRun && !String(r.output).includes("[DRY-RUN"))
);
const missing = recs.flatMap((r) =>
  REQUIRED.filter((k) => !(k in r)).map((k) => `${r.traceId}:${k}`)
);
check(`${BASELINE}: schema complete`, missing.length === 0, missing.slice(0, 3).join(", "));

const EXPECTED_SPLIT: Record<string, number> = {
  none: 20, peripheral: 20, central: 35, compound: 25,
};
const split: Record<string, number> = {};
for (const r of recs) {
  const cx = (r.dims as { complexity?: string })?.complexity ?? "?";
  split[cx] = (split[cx] ?? 0) + 1;
}
check(
  `${BASELINE}: complexity split 20/20/35/25`,
  JSON.stringify(split, Object.keys(split).sort()) ===
    JSON.stringify(EXPECTED_SPLIT, Object.keys(EXPECTED_SPLIT).sort()),
  JSON.stringify(split)
);

// --- 2. gold set: payoff labels --------------------------------------------
const GOLD = "evals1/payoff-review.md";
const GOLD_FAIL = /\bsame\b|схож|convergent|recap|переказ/i; // = payoff cfg in runJudge.ts
const txt = readFileSync(GOLD, "utf-8");
const blocks = txt.split(/\n### (T\d+-r\d+)/);
const labels = new Map<string, "fail" | "good">();
for (let i = 1; i < blocks.length; i += 2) {
  const note = (
    blocks[i + 1].match(/\*\*(?:Note|Твоя нотатка):\*\*\s*(.*)/)?.[1] ?? ""
  ).toLowerCase();
  if (!note.trim()) continue;
  labels.set(blocks[i].trim(), GOLD_FAIL.test(note) ? "fail" : "good");
}
const goldFails = Array.from(labels.values()).filter((v) => v === "fail").length;
check(`${GOLD}: 100 labels`, labels.size === 100, `got ${labels.size}`);
check(`${GOLD}: 13 gold fails`, goldFails === 13, `got ${goldFails}`);

// --- 3. real-trace files must never contain stubs ---------------------------
// (traces.jsonl is deliberately absent: committed in its post-incident stub
//  state — see scripts/eval/langfuse/README.md, "Інцидент даних")
const REAL_FILES = [
  "scripts/eval/out/traces-master.jsonl",
  "scripts/eval/out/traces-v2.jsonl",
  "scripts/eval/out/traces-fixed.jsonl",
  "scripts/eval/out/none_fixed.jsonl",
];
for (const f of REAL_FILES) {
  const rs = loadJsonl(f);
  check(
    `${f}: no dry-run stubs (${rs.length} traces)`,
    rs.every((r) => !r.dryRun && !String(r.output ?? "").includes("[DRY-RUN"))
  );
}

// --- verdict --------------------------------------------------------------
console.log("");
if (failed) {
  console.error(`${failed} integrity check(s) FAILED — reference eval data is corrupted or drifted.`);
  process.exit(1);
}
console.log("all eval-data integrity checks passed");
