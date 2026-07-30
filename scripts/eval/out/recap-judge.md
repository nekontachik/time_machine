---
tags: [eval, time-machine, judge, recap, calibration]
created: 2026-06-26
judge_model: google/gemini-3.1-flash-lite
source_traces: scripts/eval/out/traces.jsonl
source_labels: evals1/open-coding.md
---

# Recap Judge — Calibration Report

Positive class = **recap**. Calibrated against the hand-coded golden set.

## Confusion matrix

| | judge: recap | judge: not-recap |
|---|---|---|
| **gold: recap** | 13 (TP) | 0 (FN) |
| **gold: good**  | 0 (FP) | 87 (TN) |

unknown/unparsed verdicts: 0

## Metrics

- precision: **100.0%** (of judge-flagged recaps, how many are real)
- recall:    **100.0%** (of real recaps, how many judge caught)
- accuracy:  **100.0%**
- F1:        **100.0%**

> Read precision+recall, not accuracy alone: only ~15% of traces are recap,
> so a judge that says "counterfactual" every time still scores ~85% accuracy.

## Disagreements (0) — inspect these

_None._
