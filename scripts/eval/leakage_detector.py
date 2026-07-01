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

Validated on the first 100-trace run: precision 1.00, recall 0.85
(misses 2 subtle recaps that *describe* our world without *asserting* it —
that gap is where an LLM judge would later add value).
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


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    path = args[0] if args else "scripts/eval/out/traces.jsonl"
    validate = "--validate" in sys.argv

    rows = [json.loads(l) for l in open(path, encoding="utf-8") if l.strip()]
    flagged = [r["traceId"] for r in rows if is_leak(r)]

    print(f"traces: {len(rows)}   flagged as real-world leakage: {len(flagged)}")
    for t in sorted(flagged):
        print(f"  ⚑ {t}")

    if validate:
        fset = set(flagged)
        tp = len(fset & GOLD_RECAP)
        fp = sorted(fset - GOLD_RECAP)
        fn = sorted(GOLD_RECAP - fset)
        prec = tp / (tp + len(fp)) if (tp + len(fp)) else 0
        rec = tp / len(GOLD_RECAP) if GOLD_RECAP else 0
        print("\n--- validation vs human recap labels ---")
        print(f"TP={tp}  FP={len(fp)}  FN={len(fn)}")
        print(f"precision={prec:.2f}  recall={rec:.2f}")
        if fp:
            print(f"false alarms: {fp}")
        if fn:
            print(f"missed (need LLM judge): {fn}")


if __name__ == "__main__":
    main()
