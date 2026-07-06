"""Offline integration test of the DeepEval wiring (no network).

Mocks the OpenRouter call so we can verify PayoffMetric maps a judge verdict to
the right deepeval score/success without spending a real request. Needs deepeval
installed but NOT network.
"""
import os

import pytest

import payoff_judge_core as core


@pytest.fixture(autouse=True)
def _fake_key(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-test-dummy")


def _make_case():
    from deepeval.test_cases import LLMTestCase

    return LLMTestCase(
        input="beat",
        actual_output="Para one.\n\nPresent-day beat here.",
        additional_metadata={"year": 1969, "traceId": "T00-r0"},
    )


def test_different_world_passes(monkeypatch):
    monkeypatch.setattr(
        core, "call_openrouter",
        lambda spec, key, **kw: '{"verdict":"different_world","reason":"no USA"}',
    )
    from payoff_metric import PayoffMetric

    m = PayoffMetric(load_env=False)
    score = m.measure(_make_case())
    assert score == 1.0 and m.is_successful() is True and m.verdict == "different_world"


def test_same_world_fails(monkeypatch):
    monkeypatch.setattr(
        core, "call_openrouter",
        lambda spec, key, **kw: '{"verdict":"same_world","reason":"same tech"}',
    )
    from payoff_metric import PayoffMetric

    m = PayoffMetric(load_env=False)
    score = m.measure(_make_case())
    assert score == 0.0 and m.is_successful() is False and m.verdict == "same_world"


def test_metric_judges_only_the_last_paragraph(monkeypatch):
    seen = {}

    def spy(spec, key, **kw):
        seen["user"] = spec["messages"][1]["content"]
        return '{"verdict":"different_world","reason":"ok"}'

    monkeypatch.setattr(core, "call_openrouter", spy)
    from payoff_metric import PayoffMetric

    PayoffMetric(load_env=False).measure(_make_case())
    assert "Present-day beat here." in seen["user"]
    assert "Para one." not in seen["user"]
