#!/usr/bin/env python3
"""
Real-world leakage detector — first CODE-BASED eval for Time Machine.

Flags traces whose FINAL beat (the "World-2025" paragraph) describes OUR real
world instead of an alternate one. Catches:
  - NONE-recap (model retells reality when nothing was toggled)
  - any frame-break elsewhere (story slips into describing our actual 2025)

Pure regex, no model, no network. We scan only the LAST paragraph on purpose:
"as recorded / as history records" appears in the *divergence* beat of perfectly
good alternate histories too — only the ending tells recap from altworld.

Usage:
    python3 leakage_detector.py [path/to/traces.jsonl]            # list flagged
    python3 leakage_detector.py [path/to/traces.jsonl] --validate # precision/recall vs gold

REPRODUCING THE PUBLISHED 1.00 / 0.85
-------------------------------------
    python3 scripts/eval/leakage_detector.py --validate     # reads the gold beats

GOLD_RECAP below was labelled on the 2026-06-26 calibration run, whose traces
were overwritten by a dry-run rerun on 2026-07-10 (scripts/eval/langfuse/README.md).
What survived is the part this detector actually reads: the final "World-2025"
beat of all 100 traces, quoted inside evals1/payoff-review.md by the annotation
UI. So --validate now loads its beats from there by default, and the published
numbers are checkable again:

    traces: 100   flagged: 11
    TP=11  FP=0  FN=2      precision=1.00  recall=0.85
    missed (need LLM judge): ['T09-r3', 'T17-r5']

Passing a .jsonl path still works for scoring a fresh run; --validate against a
file that does not contain every GOLD_RECAP id is refused rather than silently
reporting a recall computed over a wrong denominator.
"""
import json
import re
import sys

# High-precision recap "tells" — assertions that THIS world == our world.
# Deliberately specific: bare "as we know it" is excluded because alternate
# histories use it in negations ("democracy as we know it never existed").
TELLS = [
    r"is our world",
    r"is therefore our world",
    r"the one (?:we|you) (?:already )?inhabit",
    r"\byou already know\b",
    r"the world is (?:precisely|exactly) what it is",
    r"nothing was altered",
    r"you are already living in it",
    r"(?:looks|is) precisely as we know it",
    r"the only one most people",
]
RX = re.compile("|".join(TELLS), re.I)

# Human-labeled recap set from the first run (for --validate only).
GOLD_RECAP = {
    "T02-r1", "T02-r2", "T02-r4", "T02-r5",
    "T09-r1", "T09-r2", "T09-r3", "T09-r4", "T09-r5",
    "T17-r1", "T17-r2", "T17-r4", "T17-r5",
}


def final_beat(output: str) -> str:
    parts = [p.strip() for p in (output or "").split("\n\n") if p.strip()]
    return parts[-1] if parts else ""


def is_leak(trace: dict) -> bool:
    return bool(RX.search(final_beat(trace.get("output", ""))))


REVIEW_MD = "evals1/payoff-review.md"


def load_jsonl(path: str) -> list:
    rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
    stubs = [r for r in rows if r.get("dryRun") is True or "[DRY-RUN" in str(r.get("output", ""))]
    if stubs:
        raise SystemExit(
            f"{path}: {len(stubs)}/{len(rows)} traces are dry-run stubs "
            f"(e.g. {stubs[0].get('traceId')}) — nothing measured on them means anything.\n"
            f"Use a real run (out/product_100.jsonl, out/none_fixed.jsonl, out/traces-v2.jsonl), "
            f"or run --validate with no path to score the recovered gold beats."
        )
    return rows


def load_review_beats(path: str = REVIEW_MD) -> list:
    """The gold beats recovered from the annotation file — see module docstring.

    Each card quotes the judged final paragraph as a `> ` blockquote, so this is
    the same text the detector saw on the 2026-06-26 run.
    """
    txt = open(path, encoding="utf-8").read()
    blocks = re.split(r"\n### (T\d+-r\d+)", txt)
    rows = []
    for i in range(1, len(blocks), 2):
        m = re.search(r"\n> (.*)", blocks[i + 1])
        if m:
            rows.append({"traceId": blocks[i].strip(), "output": m.group(1).strip()})
    return rows


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    validate = "--validate" in sys.argv

    if args:
        path, rows = args[0], load_jsonl(args[0])
    else:
        path, rows = REVIEW_MD, load_review_beats()

    flagged = [r["traceId"] for r in rows if is_leak(r)]

    print(f"source: {path}")
    print(f"traces: {len(rows)}   flagged as real-world leakage: {len(flagged)}")
    for t in sorted(flagged):
        print(f"  ⚑ {t}")

    if validate:
        # recall is TP / |GOLD_RECAP|, so a file missing gold traces would silently
        # report a recall against the wrong denominator. Refuse instead.
        absent = sorted(GOLD_RECAP - {r["traceId"] for r in rows})
        if absent:
            raise SystemExit(
                f"\n--validate needs every gold trace present in {path}; missing {len(absent)}: "
                f"{', '.join(absent)}.\nRecall is computed over the {len(GOLD_RECAP)} labelled "
                f"recaps, so a partial file would understate it."
            )
        fset = set(flagged)
        tp = len(fset & GOLD_RECAP)
        fp = sorted(fset - GOLD_RECAP)
        fn = sorted(GOLD_RECAP - fset)
        prec = tp / (tp + len(fp)) if (tp + len(fp)) else float("nan")
        rec = tp / len(GOLD_RECAP)
        print("\n--- validation vs human recap labels ---")
        print(f"TP={tp}  FP={len(fp)}  FN={len(fn)}")
        print(f"precision={prec:.2f}  recall={rec:.2f}")
        if fp:
            print(f"false alarms: {fp}")
        if fn:
            print(f"missed (need LLM judge): {fn}")


if __name__ == "__main__":
    main()
