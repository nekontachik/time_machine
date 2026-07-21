---
tags: [eval, time-machine, judge, payoff, score]
created: 2026-07-04
judge_model: google/gemini-3.1-flash-lite
source_traces: scripts/eval/out/product_100.jsonl
---

# payoff judge — Score (no gold)

Failure = **same-world (weak payoff)**. Measure a fix: compare failure count before vs after.

- total traces: **100**
- judged failure: **2** (2.0%)
- unknown/unparsed: 0

## Failure rate by complexity

| complexity | traces | fail | rate |
|---|---|---|---|
| central | 35 | 2 | 6% |
| none | 20 | 0 | 0% |
| peripheral | 20 | 0 | 0% |
| compound | 25 | 0 | 0% |

## Traces judged failure

| traceId | complexity | judge reason |
|---|---|---|
| T15-r3 | central | The world described possesses the same geopolitical boundaries, technology, and essentiall |
| T18-r3 | central | The world described possesses the same geopolitical structure, economic pressures, and lif |
