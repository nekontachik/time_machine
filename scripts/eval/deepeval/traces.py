"""Load JSONL traces and turn them into deepeval LLMTestCases."""
from __future__ import annotations

import json
import os
from typing import Any, Dict, Iterator, List

from payoff_judge_core import present_day_beat

# Default trace file for the pytest suite: the 20 "none" traces the TS runner
# already scored (out/payoff-score.md -> all 20 different_world).
DEFAULT_TRACES = os.path.join(os.path.dirname(__file__), "..", "out", "none_fixed.jsonl")


def load_traces(path: str) -> List[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def iter_traces(path: str) -> Iterator[Dict[str, Any]]:
    with open(path, "r", encoding="utf-8") as fh:
        for line in fh:
            if line.strip():
                yield json.loads(line)


def build_test_case(trace: Dict[str, Any]):
    """input = the present-day beat actually judged; actual_output = full story."""
    from deepeval.test_case import LLMTestCase

    output = trace["output"]
    return LLMTestCase(
        input=present_day_beat(output),
        actual_output=output,
        metadata={"year": trace["year"], "traceId": trace.get("traceId")},
    )
