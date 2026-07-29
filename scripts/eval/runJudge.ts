/**
 * Judge runner + calibration. Supports two judges:
 *
 *   --judge payoff   (DEFAULT) "Does the present-day 2025 world differ from ours?"
 *                    Open-book, product-relevant, catches recap + fizzled
 *                    divergence. Human + judge see the same input: the last
 *                    paragraph only. Labels in evals1/payoff-review.md (same/diff).
 *   --judge recap    Legacy "did it diverge anywhere?" judge. Labels in
 *                    evals1/open-coding.md (recap/переказ).
 *
 *   npx tsx --tsconfig scripts/eval/tsconfig.json scripts/eval/runJudge.ts [flags]
 *
 * Flags:
 *   --judge NAME    payoff (default) | recap
 *   --score-only    judge new traces, no gold (measure a fix; reports failure rate)
 *   --dry-run       no network: simulate a perfect judge (verdict = gold)
 *   --traces PATH   default scripts/eval/out/product_100.jsonl
 *                   (out/traces.jsonl is stub data — see loadTraces)
 *   --labels PATH   default depends on judge
 *   --out PATH      md report (default: date-stamped, depends on judge)
 *   --verdicts PATH per-trace verdicts JSONL (default: next to the md report)
 *   --limit N       first N traces only
 *   --force         allow overwriting existing report/verdicts files
 *
 * Verdicts are persisted TWICE, deliberately (lesson of the Langfuse backfill,
 * which had to reverse-engineer per-trace verdicts out of the md tables):
 *   - the .md report is for human eyes (summary, matrix, disagreements);
 *   - the .jsonl verdicts file is the machine-readable artifact: one record
 *     per trace (verdict, reason, gold, model) — reusable by any downstream
 *     tool without reconstruction. Reports are views; JSONL is data.
 *
 * CALIBRATE before trusting: positive class = the FAILURE label. Read
 * precision+recall (not accuracy — the failure class is a minority). Every
 * disagreement is listed so you can inspect where judge and human differ.
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "fs";
import { dirname } from "path";
import type { PromptSpec } from "@/lib/ai/prompts";
import { callOpenRouter } from "./openrouter";
import { recapJudgePrompt, parseVerdict } from "./judges/recapJudge";
import { payoffJudgePrompt, parsePayoffVerdict, presentDayBeat } from "./judges/payoffJudge";
import { judgeModel } from "./judges/judgeModel";

// --- flags -----------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f: string) => argv.includes(f);
const val = (f: string, d: string) => {
  const i = argv.indexOf(f);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const JUDGE = val("--judge", "payoff");
const DRY = has("--dry-run");
const SCORE_ONLY = has("--score-only");
const LIMIT = parseInt(val("--limit", "0"), 10); // 0 = all

// --- types -----------------------------------------------------------------
type Trace = {
  traceId: string;
  year: number;
  lang: string;
  changes: string;
  output: string;
  dims?: { complexity?: string };
};
type Gold = "fail" | "good";

// --- judge config (the only judge-specific bits) ---------------------------
type JudgeCfg = {
  /** verdict string that means FAILURE (positive class) */
  positive: string;
  /** verdict the dry-run "perfect judge" emits for a good trace */
  goodVerdict: string;
  /** human-readable failure name for reports */
  failName: string;
  defaultLabels: string;
  /** human note → failure? */
  goldFail: RegExp;
  /**
   * human note → explicitly GOOD?
   *
   * Set it when the labelling file has a CONTROLLED VOCABULARY (payoff-review.md
   * instructs the annotator to write exactly `same` or `diff`). Then a note that
   * matches neither vocabulary is a labelling defect and must abort the run,
   * instead of silently becoming "good".
   *
   * Leave it null for FREE-TEXT open coding (open-coding.md holds prose notes
   * like "wrong year" / "Over-attribution"), where "does not say recap" really
   * does mean "not a recap". Placeholders are still rejected — see PLACEHOLDER.
   */
  goldGood: RegExp | null;
  prompt: (t: Trace) => PromptSpec;
  parse: (text: string) => { verdict: string; reason: string };
};

const CFG: Record<string, JudgeCfg> = {
  payoff: {
    positive: "same_world",
    goodVerdict: "different_world",
    failName: "same-world (weak payoff)",
    defaultLabels: "evals1/payoff-review.md",
    goldFail: /\bsame\b|схож|convergent|recap|переказ/i,
    goldGood: /\bdiff\b|different|інш/i,
    prompt: (t) => payoffJudgePrompt({ year: t.year, present: presentDayBeat(t.output) }),
    parse: parsePayoffVerdict,
  },
  recap: {
    positive: "recap",
    goodVerdict: "counterfactual",
    failName: "recap",
    defaultLabels: "evals1/open-coding.md",
    goldFail: /recap|переказ|пересказ/i,
    goldGood: null, // free-text open coding
    prompt: (t) => recapJudgePrompt({ year: t.year, changes: t.changes, scenario: t.output }),
    parse: parseVerdict,
  },
};

const cfg = CFG[JUDGE];
if (!cfg) {
  console.error(`unknown --judge "${JUDGE}" (use: payoff | recap)`);
  process.exit(1);
}

// NOT out/traces.jsonl: that file is committed in its post-incident dry-run stub
// state (2026-07-10, see scripts/eval/langfuse/README.md) and is kept only for
// provenance. product_100.jsonl is the reproducible real run.
const TRACES = val("--traces", "scripts/eval/out/product_100.jsonl");
const LABELS = val("--labels", cfg.defaultLabels);
const FORCE = has("--force");
const STAMP = new Date().toISOString().slice(0, 10);
const MODE = SCORE_ONLY ? "score" : "judge";
const OUT = val(
  "--out",
  `scripts/eval/out/${DRY ? "dryrun/" : ""}${JUDGE}-${MODE}-${STAMP}.md`
);
const VERDICTS = val(
  "--verdicts",
  OUT.replace(/\.md$/, "") + "-verdicts.jsonl"
);

// append-only guard (see header): never silently destroy a previous artifact
for (const p of [OUT, VERDICTS]) {
  if (existsSync(p) && !FORCE) {
    console.error(
      `refusing to overwrite existing ${p} — artifacts are append-only.\n` +
        `Use --out/--verdicts for a new path, or --force to overwrite deliberately.`
    );
    process.exit(1);
  }
}

/** The machine-readable artifact: one JSONL record per judged trace. */
function writeVerdicts(
  rows: { t: Trace; g: Gold | "?"; v: string; reason: string }[],
  isFail: (v: string) => boolean
): void {
  mkdirSync(dirname(VERDICTS), { recursive: true });
  const meta = {
    judge: JUDGE,
    mode: MODE,
    judgeModel: DRY ? "(dry-run)" : judgeModel(),
    sourceTraces: TRACES,
    ...(SCORE_ONLY ? {} : { sourceLabels: LABELS }),
    ts: new Date().toISOString(),
  };
  const lines = rows.map((r) =>
    JSON.stringify({
      traceId: r.t.traceId,
      complexity: r.t.dims?.complexity ?? null,
      verdict: r.v,
      isFail: isFail(r.v),
      reason: r.reason,
      ...(SCORE_ONLY ? {} : { gold: r.g }),
      ...meta,
    })
  );
  writeFileSync(VERDICTS, lines.join("\n") + "\n");
  console.log(`verdicts -> ${VERDICTS}`);
}

// --- load ------------------------------------------------------------------
function loadTraces(path: string): Trace[] {
  const rows = readFileSync(path, "utf-8")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Trace);
  assertNotStubs(rows, path);
  return rows;
}

/**
 * A dry-run rerun once overwrote the labelled calibration traces with stubs
 * (2026-07-10; see scripts/eval/langfuse/README.md). The stub file is still
 * committed at out/traces.jsonl for provenance, and it is still the default
 * --traces value, so judging placeholder prose is one careless command away.
 * Refuse it loudly rather than reporting metrics computed on "[DRY-RUN …]".
 */
function assertNotStubs(rows: Trace[], path: string): void {
  const stubs = rows.filter(
    (r) =>
      (r as unknown as { dryRun?: boolean }).dryRun === true ||
      String(r.output ?? "").includes("[DRY-RUN")
  );
  if (!stubs.length) return;
  throw new Error(
    `${path}: ${stubs.length}/${rows.length} traces are dry-run stubs ` +
      `(e.g. ${stubs[0].traceId}) — any metric computed from them is meaningless.\n` +
      `Pass --traces with a real run (out/product_100.jsonl, out/none_fixed.jsonl, ` +
      `out/traces-v2.jsonl, out/traces-master.jsonl).`
  );
}

/**
 * Placeholder / non-answer notes. These are NOT labels. Treating one as a label
 * is exactly what silently turned two unlabelled traces into "good" (the `---`
 * filler; see evals1/pending-labels-review.md), which would have hidden a false
 * negative and quietly inflated recall.
 */
const PLACEHOLDER = /^(?:[\s\-–—_.*]+|todo|tbd|n\/?a|\?+|pending|unclear|wip|xxx)$/i;

/**
 * Golden labels from a hand-annotated review .md.
 *
 * Every note must resolve to a decision. A note that is a placeholder, or that
 * matches neither vocabulary of a controlled-vocabulary file, aborts the run
 * with the offending traceIds — it never defaults to "good". Genuinely EMPTY
 * notes are still skipped (they become "?" and are excluded from the confusion
 * matrix), because "not annotated yet" is a real state; "annotated with junk"
 * is not.
 */
function loadGold(path: string): Map<string, Gold> {
  const txt = readFileSync(path, "utf-8");
  const blocks = txt.split(/\n### (T\d+-r\d+)/);
  const m = new Map<string, Gold>();
  const problems: string[] = [];
  for (let i = 1; i < blocks.length; i += 2) {
    const id = blocks[i].trim();
    const note = (
      blocks[i + 1].match(/\*\*(?:Note|Твоя нотатка):\*\*\s*(.*)/)?.[1] ?? ""
    )
      .trim()
      .toLowerCase();
    if (!note) continue; // genuinely unlabelled → skip (becomes "?")

    if (PLACEHOLDER.test(note)) {
      problems.push(`${id}: placeholder note ${JSON.stringify(note)} — not a label`);
      continue;
    }
    const isFailNote = cfg.goldFail.test(note);
    if (!isFailNote && cfg.goldGood && !cfg.goldGood.test(note)) {
      problems.push(
        `${id}: note ${JSON.stringify(note)} matches neither the fail nor the good vocabulary`
      );
      continue;
    }
    if (m.has(id)) {
      problems.push(`${id}: duplicate card — a second label would silently overwrite the first`);
      continue;
    }
    m.set(id, isFailNote ? "fail" : "good");
  }
  if (problems.length) {
    throw new Error(
      `${path}: ${problems.length} unusable gold label(s) — refusing to guess.\n  ` +
        problems.join("\n  ")
    );
  }
  return m;
}

function snippet(s: string, n = 140): string {
  return s.replace(/\s+/g, " ").trim().slice(0, n);
}

// --- main ------------------------------------------------------------------
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

  const traces = loadTraces(TRACES);
  const gold = SCORE_ONLY ? new Map<string, Gold>() : loadGold(LABELS);
  const slice = LIMIT > 0 ? traces.slice(0, LIMIT) : traces;

  console.log(`=== ${JUDGE} judge — ${SCORE_ONLY ? "score-only (no gold)" : "calibration"} ===`);
  console.log(DRY ? "(dry-run)\n" : `(live · judge=${judgeModel()})\n`);
  if (SCORE_ONLY) {
    console.log(`traces: ${slice.length}  ·  scoring without gold (use to measure a fix)\n`);
  } else {
    const missing = slice.filter((t) => !gold.has(t.traceId)).length;
    const goldFail = slice.filter((t) => gold.get(t.traceId) === "fail").length;
    console.log(
      `traces: ${slice.length}  ·  labelled: ${slice.length - missing}  ·  unlabelled: ${missing}`
    );
    console.log(`gold: fail(${cfg.failName})=${goldFail}  good=${slice.length - missing - goldFail}\n`);
  }

  type Row = { t: Trace; g: Gold | "?"; v: string; reason: string };
  const rows: Row[] = [];

  for (const t of slice) {
    const idx = rows.length + 1;
    const t0 = Date.now();
    process.stdout.write(`[${idx}/${slice.length}] ${t.traceId} judging… `);
    const g = gold.get(t.traceId) ?? "?";
    let v: string;
    let reason = "";
    if (DRY) {
      v = g === "fail" ? cfg.positive : cfg.goodVerdict; // simulate perfect judge
      reason = "(dry-run simulated)";
    } else {
      try {
        const r = await callOpenRouter(cfg.prompt(t));
        const parsed = cfg.parse(r.text);
        v = parsed.verdict;
        reason = parsed.reason;
      } catch (err) {
        v = "unknown";
        reason = err instanceof Error ? err.message : String(err);
      }
    }
    rows.push({ t, g, v, reason });
    console.log(DRY ? v : `${v} (${Date.now() - t0}ms)`);
  }
  console.log("");

  const isFail = (v: string) => v === cfg.positive; // unknown counts as not-fail

  // --- score-only: count failures + rate by complexity (no gold) -----------
  if (SCORE_ONLY) {
    const failRows = rows.filter((r) => isFail(r.v));
    const unk = rows.filter((r) => r.v === "unknown").length;
    const byCx = new Map<string, { n: number; fail: number }>();
    for (const r of rows) {
      const cx = r.t.dims?.complexity ?? "?";
      const e = byCx.get(cx) ?? { n: 0, fail: 0 };
      e.n++;
      if (isFail(r.v)) e.fail++;
      byCx.set(cx, e);
    }
    const L: string[] = [];
    L.push("---");
    L.push(`tags: [eval, time-machine, judge, ${JUDGE}, score]`);
    L.push(`created: ${new Date().toISOString().slice(0, 10)}`);
    L.push(`judge_model: ${DRY ? "(dry-run)" : judgeModel()}`);
    L.push(`source_traces: ${TRACES}`);
    L.push("---\n");
    L.push(`# ${JUDGE} judge — Score (no gold)\n`);
    L.push(`Failure = **${cfg.failName}**. Measure a fix: compare failure count before vs after.\n`);
    L.push(`- total traces: **${rows.length}**`);
    L.push(`- judged failure: **${failRows.length}** (${((failRows.length / rows.length) * 100).toFixed(1)}%)`);
    L.push(`- unknown/unparsed: ${unk}\n`);
    L.push("## Failure rate by complexity\n");
    L.push("| complexity | traces | fail | rate |");
    L.push("|---|---|---|---|");
    for (const [cx, e] of Array.from(byCx))
      L.push(`| ${cx} | ${e.n} | ${e.fail} | ${((e.fail / e.n) * 100).toFixed(0)}% |`);
    L.push("");
    L.push("## Traces judged failure\n");
    if (!failRows.length) L.push("_None._\n");
    else {
      L.push("| traceId | complexity | judge reason |");
      L.push("|---|---|---|");
      for (const r of failRows)
        L.push(`| ${r.t.traceId} | ${r.t.dims?.complexity ?? "?"} | ${snippet(r.reason, 90)} |`);
      L.push("");
    }
    mkdirSync(dirname(OUT), { recursive: true });
    writeFileSync(OUT, L.join("\n"));
    writeVerdicts(rows, isFail);
    console.log(`failure: ${failRows.length}/${rows.length}  unknown: ${unk}`);
    for (const [cx, e] of Array.from(byCx)) console.log(`  ${cx}: ${e.fail}/${e.n}`);
    console.log(`\nreport -> ${OUT}`);
    return;
  }

  // --- confusion matrix (positive class = failure) -------------------------
  const scored = rows.filter((r) => r.g !== "?");
  let TP = 0, FP = 0, TN = 0, FN = 0, unknown = 0;
  for (const r of scored) {
    if (r.v === "unknown") unknown++;
    const goldPos = r.g === "fail";
    const predPos = isFail(r.v);
    if (goldPos && predPos) TP++;
    else if (!goldPos && predPos) FP++;
    else if (!goldPos && !predPos) TN++;
    else FN++;
  }
  const prec = TP + FP ? TP / (TP + FP) : 0;
  const rec = TP + FN ? TP / (TP + FN) : 0;
  const acc = scored.length ? (TP + TN) / scored.length : 0;
  const f1 = prec + rec ? (2 * prec * rec) / (prec + rec) : 0;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

  const disagreements = scored.filter((r) => (r.g === "fail") !== isFail(r.v));
  const L: string[] = [];
  L.push("---");
  L.push(`tags: [eval, time-machine, judge, ${JUDGE}, calibration]`);
  L.push(`created: ${new Date().toISOString().slice(0, 10)}`);
  L.push(`judge_model: ${DRY ? "(dry-run)" : judgeModel()}`);
  L.push(`source_traces: ${TRACES}`);
  L.push(`source_labels: ${LABELS}`);
  L.push("---\n");
  L.push(`# ${JUDGE} judge — Calibration Report\n`);
  L.push(`Positive class = **${cfg.failName}**. Calibrated against the hand-coded golden set.\n`);
  L.push("## Confusion matrix\n");
  L.push("| | judge: fail | judge: good |");
  L.push("|---|---|---|");
  L.push(`| **gold: fail** | ${TP} (TP) | ${FN} (FN) |`);
  L.push(`| **gold: good** | ${FP} (FP) | ${TN} (TN) |`);
  L.push(`\nunknown/unparsed verdicts: ${unknown}\n`);
  L.push("## Metrics\n");
  L.push(`- precision: **${pct(prec)}** (of judge-flagged failures, how many are real)`);
  L.push(`- recall:    **${pct(rec)}** (of real failures, how many judge caught)`);
  L.push(`- accuracy:  **${pct(acc)}**`);
  L.push(`- F1:        **${pct(f1)}**\n`);
  L.push("> Read precision+recall, not accuracy alone — the failure class is a minority.\n");
  L.push(`## Disagreements (${disagreements.length}) — inspect these\n`);
  if (!disagreements.length) {
    L.push("_None._\n");
  } else {
    L.push("| traceId | complexity | gold | judge | judge reason | present-day snippet |");
    L.push("|---|---|---|---|---|---|");
    for (const r of disagreements) {
      const beat = JUDGE === "payoff" ? presentDayBeat(r.t.output) : r.t.output;
      L.push(
        `| ${r.t.traceId} | ${r.t.dims?.complexity ?? "?"} | ${r.g} | ${r.v} | ${snippet(
          r.reason,
          80
        )} | ${snippet(beat, 120)} |`
      );
    }
    L.push("");
  }

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, L.join("\n"));
  writeVerdicts(rows, isFail);

  console.log(`confusion: TP=${TP} FP=${FP} TN=${TN} FN=${FN}  unknown=${unknown}`);
  console.log(`precision=${pct(prec)}  recall=${pct(rec)}  acc=${pct(acc)}  F1=${pct(f1)}`);
  console.log(`disagreements: ${disagreements.length}`);
  console.log(`\nreport -> ${OUT}`);
  if (!DRY && (prec < 0.8 || rec < 0.8)) {
    console.log("\n⚠ agreement < 80% — read the disagreements before trusting this judge.");
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
