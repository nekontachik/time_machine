"""
PayoffMetric — the calibrated payoff judge exposed as a DeepEval custom metric.

This is a WRAPPER (an execution/grading layer), not a new evaluator. All judging
behavior lives in payoff_judge_core.py, which is a byte-for-byte port of
scripts/eval/judges/payoffJudge.ts. This file only adapts that judge to
deepeval's BaseMetric interface.

Verdict -> DeepEval encoding (binary, no scale, no threshold tuning):
    different_world (good)    -> score 1.0, success True
    same_world      (failure) -> score 0.0, success False
    unknown         (unparsed)-> score 0.0, success False
threshold is fixed at 0.5 purely to encode the binary pass/fail; there is no
1-5 scale and no score cutoff layered on top of the judge.
"""
from __future__ import annotations

from typing import Any

from deepeval.metrics import BaseMetric
from deepeval.test_cases import LLMTestCase

from payoff_judge_core import (
    judge_model,
    load_repo_env,
    present_day_beat,
    require_api_key,
    run_judge,
)


class PayoffMetric(BaseMetric):
    """Binary payoff judge: does the story's present-day world differ from ours?"""

    def __init__(self, threshold: float = 0.5, model: str | None = None, load_env: bool = True):
        if load_env:
            load_repo_env()
        self.threshold = threshold
        self.model_name = model or judge_model()
        # BaseMetric fields various deepeval versions expect:
        self.evaluation_model = self.model_name
        self.include_reason = True
        self.async_mode = False
        self.strict_mode = False
        self.verbose_mode = False
        self.error: str | None = None
        self.score: float | None = None
        self.reason: str | None = None
        self.success: bool = False
        self.verdict: str | None = None

    @property
    def __name__(self) -> str:  # shown in deepeval reports
        return "Payoff (weak-payoff / same-world)"

    def measure(self, test_case: LLMTestCase, *args: Any, **kwargs: Any) -> float:
        # Judge exactly what the TS runner judges: the present-day beat, extracted
        # from the full story (actual_output), plus the divergence year.
        beat = present_day_beat(test_case.actual_output or "")
        meta = test_case.additional_metadata or {}
        if "year" not in meta:
            raise ValueError("LLMTestCase.additional_metadata must include 'year'")
        year = int(meta["year"])

        api_key = require_api_key()
        verdict, reason = run_judge(beat, year, api_key, model=self.model_name)

        self.verdict = verdict
        self.reason = reason
        self.score = 1.0 if verdict == "different_world" else 0.0
        self.success = verdict == "different_world"
        return self.score

    async def a_measure(self, test_case: LLMTestCase, *args: Any, **kwargs: Any) -> float:
        # The judge call is a single blocking HTTP request; no true async needed.
        return self.measure(test_case, *args, **kwargs)

    def is_successful(self) -> bool:
        return self.success
