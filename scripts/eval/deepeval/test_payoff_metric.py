"""DeepEval pytest suite — run the calibrated payoff judge over a JSONL of traces.

Requires network + OPENROUTER_API_KEY (loaded from .env.local). This makes one
live judge call per trace and reports in DeepEval style.

    # default: the 20 "none" traces (all different_world -> a green run)
    pytest scripts/eval/deepeval/test_payoff_metric.py -s

    # any other JSONL of traces:
    PAYOFF_TRACES=scripts/eval/out/product_100.jsonl \\
      pytest scripts/eval/deepeval/test_payoff_metric.py -s

A test PASSES when the judge says different_world (good payoff) and FAILS on
same_world (weak payoff) — i.e. the suite surfaces weak-payoff traces. This is a
local harness only; CI wiring is a separate, future task.
"""
import os

import pytest

from traces import DEFAULT_TRACES, build_test_case, load_traces

TRACES_PATH = os.environ.get("PAYOFF_TRACES", DEFAULT_TRACES)


def _load():
    if not os.path.exists(TRACES_PATH):
        pytest.skip(f"traces file not found: {TRACES_PATH}")
    return load_traces(TRACES_PATH)


_TRACES = _load() if os.path.exists(TRACES_PATH) else []


@pytest.mark.skipif(not _TRACES, reason="no traces file present")
@pytest.mark.parametrize(
    "trace", _TRACES, ids=[t.get("traceId", str(i)) for i, t in enumerate(_TRACES)]
)
def test_payoff(trace):
    from deepeval import assert_test

    from payoff_metric import PayoffMetric

    test_case = build_test_case(trace)
    metric = PayoffMetric()
    assert_test(test_case, [metric])
