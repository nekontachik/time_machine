# Evaluation Work — Time Machine

Time Machine is a PWA that generates alternative histories: Gemini drafts the historical events, Claude Sonnet writes a 3-paragraph counterfactual. This document summarizes how I built and validated an evaluation system for that two-model pipeline. It is written to stand on its own — no need to open any code.

## Method

I started from data, not metrics: I read **100 real traces by hand** (open coding → axial coding) to build a failure taxonomy grounded in what actually goes wrong. From there I fixed the highest-impact defect at the prompt level, wrote a **cheap deterministic detector** for the mechanical failures, and built a **calibrated LLM-as-judge** for the one subjective failure that survived. Finally I used the validated judge to measure a **product baseline** on fresh traffic. Because the product has no real users yet, all traces are synthetic: I defined variation *dimensions* → 20 seed tuples → ~100 generated traces.

## Failure taxonomy (100 traces)

Modes attributed to the pipeline stage that causes them (Gemini = events, Claude = narrative, product/prompt = design defect):

| Failure mode | Count | Stage | Note |
|---|---|---|---|
| **NONE-recap** — retells real history instead of a counterfactual | 13 | product/prompt | occurs *only* in the `none` complexity condition |
| Wrong-year padding | 6 | Gemini | serious; surfaces in the UI card, not the narrative |
| Fuzzy ancient dating | 5 | Gemini | soft / by-design |
| Fabricated / impossible event | 5 | Gemini | worst severity; concentrated in the weakest event slot |
| Imprecise framing / conflation | 3 | Gemini | soft |
| Over-attribution (overstated causality) | 1 | Claude | low severity |
| Solid narrative (not a failure) | 82 | Claude | the narrative model is clean outside the `none` defect |

The signal that drove everything: NONE-recap was not a "bad model" problem but a **contradictory prompt** — when nothing is toggled off, the product tells the model "all events happened" *and* "write an alternative history."

## Deterministic detector

`leakage_detector.py` catches the mechanical failures (recap / frame-break) with **precision 1.00 / recall 0.85**. Cheap, fast, and reserved for what regex can actually decide — no LLM judge where an assertion suffices.

## Fix + triple verification

I fixed NONE-recap at the prompt level. Recap rate on the `none` cohort dropped from **11/20 → 0/20**, verified three independent ways: the regex detector (0/20), the calibrated judge (0/20), and a full manual read of all 20 (0/20). The detector's known blind spot (recall 0.85) was checked directly and came back empty.

## Judge calibration (validating the validator)

The subjective failure — **weak payoff** (`same_world`: the alternative world ends up materially identical to ours) — needs an LLM-as-judge. Binary pass/fail, calibrated against a **gold set of 100 hand-labeled traces (13 fail / 87 good)**.

- **Round 1: precision 58.8% / recall 100%.** The judge over-flagged but never missed a real failure.
- I re-read **all 7 disagreements** together and found the root cause: the judge fixated on technology parity ("same gadgets") and ignored changed institutions and culture. I also caught **3 wrong gold labels** and corrected them. The revised prompt was independently red-teamed.
- **Final: precision 92.9% / recall 100%**, with one deliberately accepted borderline false positive.

The judge runs on a **different model family than the generator** (gemini-3.1-flash-lite judging claude-sonnet output), which guards against self-preference bias.

## Product baseline

Measured with the validated judge on **100 fresh traces**: weak-payoff rate **2.0%**, 95% Wilson CI **[0.6%, 7.0%]**. Both flagged failures were human-adjudicated as true failures (ground truth), and the judge scored 2/2 with no false positives on this unseen data. Failures concentrate entirely in the `central` complexity condition — **2/35 ≈ 5.7%** (CI [1.6%, 18.6%]) — while `none`, `peripheral`, and `compound` were all 0.

## Limitations

These are stated plainly because knowing where a result is thin is part of the work:

- **Overfitting risk.** The judge's precision/recall were measured on the same gold set the prompt was iterated against. Mitigation: on a fresh 100 traces the judge produced 2/2 human-confirmed failures with zero false positives — evidence it generalizes, but not a clean held-out validation.
- **Small n on the NONE fix.** The 0/20 verification rests on 20 traces; the remaining uncertainty is statistical.
- **`central` hypothesis is thin.** The "central is the weak spot" claim rests on 2 failing examples, so its confidence interval is wide ([1.6%, 18.6%]). It points a direction; it doesn't settle the number.

---

*Artifacts: reports and gold set in `evals1/` (`SUMMARY.md`, `TAXONOMY.md`, `payoff-review.md`); code in `scripts/eval/` (`judges/payoffJudge.ts`, `runJudge.ts`, `leakage_detector.py`).*
