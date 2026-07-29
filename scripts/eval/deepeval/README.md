# DeepEval wrapper — payoff judge

This is a **wrapper** (execution/grading layer) around the already-calibrated
payoff judge — precision 92.9% / recall 100% vs the gold set. It is **not** a new
evaluator. All judging behavior is a byte-for-byte port of
`../judges/payoffJudge.ts` (frozen prompt, model `google/gemini-3.1-flash-lite`
via `JUDGE_MODEL`, `max_tokens=200`, no temperature). See `../../../EVALS.md`.

Setup: `pip install -r requirements.txt` · `OPENROUTER_API_KEY` is read from
`.env.local` at the repo root.

```bash
# offline checks (no key needed): frozen-prompt byte-parity + core logic
pytest scripts/eval/deepeval/test_core.py scripts/eval/deepeval/test_prompt_source_parity.py -q

# DeepEval suite over a JSONL of traces (LIVE, one judge call per trace)
pytest scripts/eval/deepeval/test_payoff_metric.py -s          # default: out/none_fixed.jsonl

# Parity vs the TS runner on 20 traces (acceptance criterion):
node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \
  scripts/eval/deepeval/ts_reference.ts \
  --traces scripts/eval/out/product_100.jsonl --limit 18 --ids T15-r3,T18-r3 --live \
  > scripts/eval/deepeval/ts_verdicts.jsonl
python scripts/eval/deepeval/run_parity.py --ts scripts/eval/deepeval/ts_verdicts.jsonl \
  --traces scripts/eval/out/product_100.jsonl --limit 18 --ids T15-r3,T18-r3
```

### Which traces the parity run uses, and why it changed

`parity-table.md` in this directory records the original run (2026-07-06,
**20/20**) over the first 20 traces of `out/traces.jsonl` — a slice chosen
because it carried 4 gold `same_world` failures, so parity exercised both
verdicts rather than only "good".

Those texts no longer exist. A dry-run rerun overwrote `out/traces.jsonl` with
`[DRY-RUN …]` stubs on 2026-07-10 (see `../langfuse/README.md`); the file is
still committed in that state for provenance, and the originals are
unrecoverable. Re-running the old command today would score placeholder prose
and print a parity table that looks fine and means nothing — so `ts_reference.ts`
and `run_parity.py` now **refuse** stub input outright.

`out/product_100.jsonl` is the reproducible substitute: 100 real traces from the
product baseline run. Its only two `same_world` traces are **T15-r3** and
**T18-r3** (`../out/product_100-score.md`, both human-adjudicated in
`../../../evals1/adjudication-central-fails.md`), and neither is in the head of
the file — so `--ids` pins them into the slice and `--limit` fills the rest.
Drop `--ids` and parity silently degrades to a one-class check.

**What 20/20 does and does not mean.** It is *verdict agreement between the
Python wrapper and the TypeScript runner* on the same traces — an execution-layer
port check. It is **not** an accuracy figure, and it does not re-calibrate
anything: the judge, the runner and the gold set are unchanged.

Verdict → DeepEval: `different_world` (good) = pass/score 1.0; `same_world`
(weak payoff) = fail/score 0.0. Binary only — no scale, no threshold tuning.
If parity disagrees systematically, fix the port here — never edit the frozen
TS judge, `runJudge.ts`, or the gold set.
