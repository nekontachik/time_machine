"""Offline byte-parity: Python-built prompt == TypeScript-built prompt.

This is the strongest guarantee that the wrapper feeds the judge IDENTICAL input.
It needs a fixtures file produced by the TS reference (no network required):

    node_modules/.bin/tsx --tsconfig scripts/eval/tsconfig.json \\
      scripts/eval/deepeval/ts_reference.ts \\
      --traces scripts/eval/out/none_fixed.jsonl --limit 5 \\
      > scripts/eval/deepeval/prompt_fixtures.jsonl

Each fixture line has {traceId, year, present, model, maxTokens, messages}. We
rebuild the prompt in Python from (year, present) and assert char-for-char match.
If this test fails, the port drifted from payoffJudge.ts — fix the port, do NOT
edit the TS.
"""
import json
import os

import pytest

from payoff_judge_core import build_payoff_prompt

FIXTURES = os.environ.get(
    "PAYOFF_FIXTURES", os.path.join(os.path.dirname(__file__), "prompt_fixtures.jsonl")
)


def _load():
    if not os.path.exists(FIXTURES):
        pytest.skip(
            f"no fixtures at {FIXTURES}; generate with ts_reference.ts (see module docstring)"
        )
    with open(FIXTURES, "r", encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip()]


_FIX = _load() if os.path.exists(FIXTURES) else []


@pytest.mark.skipif(not _FIX, reason="no prompt_fixtures.jsonl present")
@pytest.mark.parametrize("fix", _FIX, ids=[f.get("traceId", str(i)) for i, f in enumerate(_FIX)])
def test_prompt_byte_parity(fix):
    py = build_payoff_prompt(fix["year"], fix["present"], model=fix.get("model"))
    assert py["max_tokens"] == fix["maxTokens"], "max_tokens drifted"
    assert py["messages"] == fix["messages"], "prompt text drifted from payoffJudge.ts"
