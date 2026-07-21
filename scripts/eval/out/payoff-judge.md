---
tags: [eval, time-machine, judge, payoff, calibration]
created: 2026-07-02
judge_model: google/gemini-3.1-flash-lite
source_traces: scripts/eval/out/traces.jsonl
source_labels: evals1/payoff-review.md
---

# payoff judge — Calibration Report

Positive class = **same-world (weak payoff)**. Calibrated against the hand-coded golden set.

## Confusion matrix

| | judge: fail | judge: good |
|---|---|---|
| **gold: fail** | 13 (TP) | 0 (FN) |
| **gold: good** | 1 (FP) | 86 (TN) |

unknown/unparsed verdicts: 0

## Metrics

- precision: **92.9%** (of judge-flagged failures, how many are real)
- recall:    **100.0%** (of real failures, how many judge caught)
- accuracy:  **99.0%**
- F1:        **96.3%**

> Read precision+recall, not accuracy alone — the failure class is a minority.

## Disagreements (1) — inspect these

| traceId | complexity | gold | judge | judge reason | present-day snippet |
|---|---|---|---|---|---|
| T20-r2 | peripheral | good | same_world | The described world relies on the same digital infrastructure, popular platforms | In 2025, the streaming algorithms that govern what most people hear were trained on a different corpus. The slow, envelo |
