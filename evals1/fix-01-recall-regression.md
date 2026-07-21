---
tags: [eval, time-machine, event-year-accuracy, regression]
branch: fix/event-year-accuracy
status: OPEN — needs prompt v2 (or explicit accept)
repro: scripts/eval/runQ1.ts → scripts/eval/out/q1-density-shift.md
---

# Fix 01 — Recall Regression on Dense Years (prompt v1)

## What happened

The year-accuracy prompt fix (v1) **eliminated wrong-year padding** on sparse years
(1237/800/3000 BCE: ~6 wrong-year/century events → 0) — the intended win. But a
distribution check (Q1, all 20 harness years, old vs new prompt in one run,
`google/gemini-3.1-flash-lite`, 3 runs/year) shows v1 also introduced an
**unintended recall regression**: it reduces event count across the distribution,
dropping *genuine same-year* events on rich years.

## Concrete metrics (before = v0 "exactly 3", after = v1)

**Dense (high-density) years — the control set. 4 of 9 dropped below 3:**

| year | before avg | after avg (v1) |
|---|---|---|
| 44 BCE | 3.0 | **2.0** |
| 79 | 3.0 | **2.0** |
| 1517 | 3.0 | **2.3** |
| 1914 | 3.0 | **2.7** |
| 1066 | 3.0 | 3.0 |
| 1347 | 3.0 | 3.0 |
| 1789 | 3.0 | 3.0 |
| 1969 | 3.0 | 3.0 |
| 1989 | 3.0 | 3.0 |

**Medium years — most dropped:** 753 BCE 3.0 → **1.0**; 410/313/800 → 2.0; 1648/1755/1871/1973 held at 3.0.
**Low years:** 3000 BCE → 2.0; 1237 → 2.3; 1816 → 3.0.

Dropped events on rich years are **genuine** (e.g. 1914 has Franz Ferdinand +
Panama Canal + Ford $5 day — all real 1914; v1 returns 2, dropping one real event).
So this is a loss of *completeness*, not *correctness*.

## Interpretation — precision/recall trade-off

v1 bought **year-accuracy (precision)** — zero events from other years — at the cost
of **recall** — fewer events, dropping genuine ones on dense years.

## Root cause

The v1 prompt conflated two goals:
1. (wanted) **do not pad with events from other years**;
2. (unwanted) **return fewer events overall**.

Wording — *"if not confident, omit… fewer correct events is REQUIRED over padding"* —
over-weighted (2), so the model suppresses events even on rich years where 3 confident
same-year events exist.

## Downstream risks

- **Product:** rich years give fewer toggle options (2 instead of 3). Minor UX cost, not a bug.
- **Eval harness:** years returning 1 event (e.g. 753 BCE) cannot form `compound`/`central`
  complexity toggles (those need ≥2 events) → coverage degradation in `runTraces`.

## Decision (pending, benevolent dictator)

- **Accept** the trade-off (fewer-but-correct is fine for this product), OR
- **Refine to v2:** separate the two goals — "include every event you are confident is this
  year, up to 3; never add an event from another year." Then re-run Q1 to confirm dense
  years recover to ~3 AND sparse years stay 1–2 without padding returning.

Recommended: v2 (dropping genuine events on rich years is an avoidable cost we did not intend).

## v2 resolution + verification (Layer A / B)

v2 wording ("include every confident same-year event, up to 3; never pad with other years")
recovered dense-year count and was promoted into `lib/ai/prompts.ts` (net diff v0 → v2; v1 never committed).

**Layer B — scenario quality** (payoff judge, SAME judge `google/gemini-3.1-flash-lite` on both sides):
- baseline (`product_100.jsonl`): **2/100** weak-payoff (2.0%), concentrated central 2/35.
- v2 (`traces-v2.jsonl`): **0/100** (0.0%).
- **No downward drift.** 0 vs 2 is NOT statistically significant (overlapping Wilson CIs), so the honest
  claim is "no regression", not "improvement". Judge validated as discriminating: the same judge caught
  2 failures in baseline and 0 in v2 (so 0% is not a sleeping judge).

**Layer A — harness mechanics:**
- No crash; all 100 traces produced and judged.
- BUT separability collapse jumped **0% (baseline) → 25% (v2)**: 20 single-tier (all-high) + 5 from 753 BCE (1 event).
- **Cause — hidden coupling.** The complexity axis (peripheral vs central) relied on the OLD prompt producing
  a high/medium/low tier spread — which came partly from *padding* (filler low-impact events). v2's honest
  event sets on rich years are often all-high (e.g. 1789: Bastille + Washington inauguration + Lavoisier — all high),
  so the tier spread the axis needs is absent, and `assertSeparable` flags the trace.
- **Impact:** ~25% of traces have a degenerate peripheral-vs-central axis. Product unaffected (Layer B clean);
  this is eval-infra debt, not a product bug.

**Status:** product fix (v2) is quality-safe and shippable. Harness separability is a separate follow-up
(re-anchor complexity so it does not require tier diversity, or handle/re-roll collapsed traces).

## Prediction log

- Q1 dense-year dip — user predicted "~half of 9"; assistant predicted "0–2 (noise)".
  Actual: 4 of 9. User correct; assistant wrong.
- Layer B drift — both predicted "within CI / no downward drift". Actual: 0% vs 2% — confirmed, no regression.
  Neither predicted the 25% separability collapse (Layer A) — the harness effect surfaced only by checking A.
