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

# Parity vs the TS runner on 20 gold traces (acceptance criterion):
node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \
  scripts/eval/deepeval/ts_reference.ts \
  --traces scripts/eval/out/traces.jsonl --limit 20 --live > scripts/eval/deepeval/ts_verdicts.jsonl
python scripts/eval/deepeval/run_parity.py --ts scripts/eval/deepeval/ts_verdicts.jsonl \
  --traces scripts/eval/out/traces.jsonl --limit 20
```

Verdict → DeepEval: `different_world` (good) = pass/score 1.0; `same_world`
(weak payoff) = fail/score 0.0. Binary only — no scale, no threshold tuning.
If parity disagrees systematically, fix the port here — never edit the frozen
TS judge, `runJudge.ts`, or the gold set.
