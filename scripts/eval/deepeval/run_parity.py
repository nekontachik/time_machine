"""
Parity check (acceptance criterion): wrapper verdicts vs the original TS runner,
on the SAME traces. This does NOT re-calibrate against the gold set — the judge is
unchanged; we only prove the Python wrapper reproduces the TS judge's behavior.

Two steps (both need network + OPENROUTER_API_KEY from .env.local):

  1) Produce the TS baseline (the "original") on the first 20 gold traces:
       node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \\
         scripts/eval/deepeval/ts_reference.ts \\
         --traces scripts/eval/out/traces.jsonl --limit 20 --live \\
         > scripts/eval/deepeval/ts_verdicts.jsonl

  2) Run the wrapper on the same 20 and print the parity table:
       python scripts/eval/deepeval/run_parity.py \\
         --ts scripts/eval/deepeval/ts_verdicts.jsonl \\
         --traces scripts/eval/out/traces.jsonl --limit 20

The first 20 traces of out/traces.jsonl include 4 gold failures (T02-r1/r2/r4/r5),
so parity exercises BOTH classes, not just "good" traces.

Reading the result: identical verdicts = wrapper is faithful. A few isolated
disagreements on borderline beats = LLM nondeterminism (both engines call an LLM),
acceptable. A systematic, one-directional gap = the wrapper broke something —
inspect the prompt/model/input, do NOT tune to match.
"""
from __future__ import annotations

import argparse
import json
import os
import re
from typing import Dict

from payoff_judge_core import (
    load_repo_env,
    present_day_beat,
    require_api_key,
    run_judge,
)

HERE = os.path.dirname(__file__)


def load_gold(review_path: str) -> Dict[str, str]:
    """Optional context column: human labels from evals1/payoff-review.md."""
    if not os.path.exists(review_path):
        return {}
    txt = open(review_path, encoding="utf-8").read()
    blocks = re.split(r"\n### (T\d+-r\d+)", txt)
    rx = re.compile(r"\bsame\b|схож|convergent|recap|переказ", re.I)
    gold: Dict[str, str] = {}
    for i in range(1, len(blocks), 2):
        tid = blocks[i].strip()
        m = re.search(r"\*\*(?:Note|Твоя нотатка):\*\*\s*(.*)", blocks[i + 1])
        note = (m.group(1) if m else "").strip().lower()
        if not note:
            continue
        gold[tid] = "fail" if rx.search(note) else "good"
    return gold


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ts", required=True, help="ts_verdicts.jsonl from ts_reference.ts --live")
    ap.add_argument("--traces", default=os.path.join(HERE, "..", "out", "traces.jsonl"))
    ap.add_argument("--limit", type=int, default=20)
    ap.add_argument("--review", default=os.path.join(HERE, "..", "..", "..", "evals1", "payoff-review.md"))
    ap.add_argument("--out", default=os.path.join(HERE, "parity-table.md"))
    args = ap.parse_args()

    load_repo_env()
    api_key = require_api_key()

    ts = {}
    with open(args.ts, encoding="utf-8") as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError:
                # Skip non-JSON noise, e.g. a dotenv banner captured in stdout.
                continue
            ts[r["traceId"]] = r
    if not ts:
        raise SystemExit(f"no TS verdicts in {args.ts} (did you pass --live?)")

    traces = []
    with open(args.traces, encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                traces.append(json.loads(line))
    traces = traces[: args.limit]
    gold = load_gold(args.review)

    rows = []
    disagree = 0
    for i, t in enumerate(traces, 1):
        tid = t["traceId"]
        if tid not in ts:
            continue
        beat = present_day_beat(t["output"])
        print(f"[{i}/{len(traces)}] {tid} judging (wrapper)…", flush=True)
        w_verdict, _ = run_judge(beat, t["year"], api_key)
        o_verdict = ts[tid].get("verdict", "?")
        match = w_verdict == o_verdict
        if not match:
            disagree += 1
        rows.append((tid, gold.get(tid, "-"), o_verdict, w_verdict, match))

    # ---- report ----
    n = len(rows)
    agree = n - disagree
    lines = []
    lines.append("# Parity — DeepEval wrapper vs TS runner (payoff judge)\n")
    lines.append(f"model: {os.environ.get('JUDGE_MODEL', '(default)')}  ·  traces: {n}\n")
    lines.append("| traceId | gold | original (TS) | wrapper (DeepEval) | match |")
    lines.append("|---|---|---|---|---|")
    for tid, g, o, w, m in rows:
        lines.append(f"| {tid} | {g} | {o} | {w} | {'✅' if m else '❌'} |")
    lines.append("")
    lines.append(f"**Agreement: {agree}/{n}**  ·  disagreements: {disagree}\n")
    if disagree == 0:
        lines.append("Conclusion: verdicts identical — wrapper reproduces the TS judge exactly.")
    elif disagree <= 2:
        lines.append(
            "Conclusion: isolated disagreement(s) only. Open the trace(s): if the "
            "present-day beat is borderline, this is expected LLM nondeterminism "
            "(both sides call an LLM), not a broken wrapper."
        )
    else:
        lines.append(
            "Conclusion: too many disagreements to be pure noise. Suspect a real "
            "difference in prompt/model/input fragment. Run test_prompt_parity.py "
            "and inspect — do NOT tune the wrapper to match."
        )
    report = "\n".join(lines)
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write(report + "\n")
    print("\n" + report)
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
