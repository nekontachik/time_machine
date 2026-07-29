"""
Parity check (acceptance criterion): wrapper verdicts vs the original TS runner,
on the SAME traces. This does NOT re-calibrate against the gold set — the judge is
unchanged; we only prove the Python wrapper reproduces the TS judge's behavior.

Two steps (both need network + OPENROUTER_API_KEY from .env.local):

  1) Produce the TS baseline (the "original"):
       node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \\
         scripts/eval/deepeval/ts_reference.ts \\
         --traces scripts/eval/out/product_100.jsonl --limit 18 \\
         --ids T15-r3,T18-r3 --live \\
         > scripts/eval/deepeval/ts_verdicts.jsonl

  2) Run the wrapper on the same slice and print the parity table:
       python scripts/eval/deepeval/run_parity.py \\
         --ts scripts/eval/deepeval/ts_verdicts.jsonl \\
         --traces scripts/eval/out/product_100.jsonl --limit 18 --ids T15-r3,T18-r3

WHY THIS SLICE. Parity is only meaningful if it exercises BOTH verdicts. The
original run (2026-07-06, parity-table.md) used the first 20 of out/traces.jsonl
because that slice carried 4 gold `same_world` failures. That file no longer
holds those texts: a dry-run rerun overwrote it with stubs on 2026-07-10 (see
scripts/eval/langfuse/README.md) and the originals are unrecoverable. Running
the old command today would judge "[DRY-RUN …]" placeholders, so both this
script and ts_reference.ts now REFUSE stub input outright.

out/product_100.jsonl is the reproducible substitute — 100 real traces, and the
two the judge scored `same_world` are T15-r3 and T18-r3 (out/product_100-score.md,
both human-adjudicated in evals1/adjudication-central-fails.md). `--ids` pins
them into the slice; `--limit 18` fills the rest from the top of the file.
Without --ids, the first 20 of product_100.jsonl are all `different_world` and
parity would only ever prove one direction.

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


# Vocabulary + placeholder rules mirror loadGold() in ../runJudge.ts and the
# gold block in ../ciChecks.ts. Three parsers read evals1/payoff-review.md; if
# you change the rule, change it in all three.
GOLD_FAIL = re.compile(r"\bsame\b|схож|convergent|recap|переказ", re.I)
GOLD_GOOD = re.compile(r"\bdiff\b|different|інш", re.I)
PLACEHOLDER = re.compile(r"^(?:[\s\-–—_.*]+|todo|tbd|n/?a|\?+|pending|unclear|wip|xxx)$", re.I)


def load_gold(review_path: str) -> Dict[str, str]:
    """Human labels from evals1/payoff-review.md (the `gold` column of the table).

    payoff-review.md has a CONTROLLED VOCABULARY — the annotator instructions at
    the top of that file say to write exactly `same` or `diff`. So a note that is
    a placeholder, or that matches neither vocabulary, is a labelling defect and
    raises. It must never fall through to "good": the `---` filler doing exactly
    that is how two traces were silently mislabelled once already
    (evals1/pending-labels-review.md).
    """
    if not os.path.exists(review_path):
        return {}
    txt = open(review_path, encoding="utf-8").read()
    blocks = re.split(r"\n### (T\d+-r\d+)", txt)
    gold: Dict[str, str] = {}
    problems = []
    for i in range(1, len(blocks), 2):
        tid = blocks[i].strip()
        m = re.search(r"\*\*(?:Note|Твоя нотатка):\*\*\s*(.*)", blocks[i + 1])
        note = (m.group(1) if m else "").strip().lower()
        if not note:
            continue  # genuinely unlabelled → absent from the map
        if PLACEHOLDER.match(note):
            problems.append(f"{tid}: placeholder note {note!r} — not a label")
            continue
        is_fail = bool(GOLD_FAIL.search(note))
        if not is_fail and not GOLD_GOOD.search(note):
            problems.append(f"{tid}: note {note!r} matches neither vocabulary")
            continue
        if tid in gold:
            problems.append(f"{tid}: duplicate card — the second label would overwrite the first")
            continue
        gold[tid] = "fail" if is_fail else "good"
    if problems:
        raise SystemExit(
            f"{review_path}: {len(problems)} unusable gold label(s) — refusing to guess.\n  "
            + "\n  ".join(problems)
        )
    return gold


def assert_not_stubs(rows, path: str) -> None:
    """A dry-run rerun overwrote out/traces.jsonl with stubs on 2026-07-10 (see
    ../langfuse/README.md). Judging placeholders would produce a parity table
    that looks fine and means nothing, so refuse the input instead."""
    stubs = [r for r in rows if r.get("dryRun") is True or "[DRY-RUN" in str(r.get("output", ""))]
    if stubs:
        raise SystemExit(
            f"{path}: {len(stubs)}/{len(rows)} traces are dry-run stubs "
            f"(e.g. {stubs[0].get('traceId')}) — parity on stub text is meaningless.\n"
            f"Use a real run, e.g. scripts/eval/out/product_100.jsonl."
        )


def select(rows, limit: int, ids: str):
    """First `limit` traces, with any --ids pinned in front (deduped, order kept).

    Pinning matters: parity must exercise both verdicts, and in product_100.jsonl
    the only two `same_world` traces (T15-r3, T18-r3) are not in the head of the
    file. Unknown ids raise rather than shrinking the slice unnoticed.
    """
    wanted = [i.strip() for i in ids.split(",") if i.strip()] if ids else []
    by_id = {r["traceId"]: r for r in rows}
    missing = [i for i in wanted if i not in by_id]
    if missing:
        raise SystemExit(f"--ids not found in traces: {', '.join(missing)}")
    picked = [by_id[i] for i in wanted]
    seen = set(wanted)
    for r in rows:
        if len(picked) >= limit + len(wanted):
            break
        if r["traceId"] not in seen:
            picked.append(r)
            seen.add(r["traceId"])
    return picked


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ts", required=True, help="ts_verdicts.jsonl from ts_reference.ts --live")
    ap.add_argument("--traces", default=os.path.join(HERE, "..", "out", "product_100.jsonl"))
    ap.add_argument("--limit", type=int, default=18)
    ap.add_argument(
        "--ids",
        default="T15-r3,T18-r3",
        help="comma-separated traceIds pinned into the slice (the known same_world cases)",
    )
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
    assert_not_stubs(traces, args.traces)
    traces = select(traces, args.limit, args.ids)
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
