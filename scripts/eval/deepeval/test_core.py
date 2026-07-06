"""Offline unit tests for the frozen deterministic core (no network, no deepeval).

Run: pytest scripts/eval/deepeval/test_core.py
These lock the behavior that must match payoffJudge.ts: which paragraph is judged,
the year label, and verdict parsing (incl. the JSON-first / keyword-fallback path).
"""
from payoff_judge_core import (
    parse_payoff_verdict,
    present_day_beat,
    year_label,
)


def test_year_label():
    assert year_label(1969) == "1969"
    assert year_label(0) == "0"
    assert year_label(-44) == "44 BCE"
    assert year_label(-3000) == "3000 BCE"


def test_present_day_beat_last_paragraph():
    story = "Para one.\n\nPara two.\n\nPresent day beat."
    assert present_day_beat(story) == "Present day beat."


def test_present_day_beat_collapses_blank_runs_and_trims():
    story = "  A  \n\n\n\n  B last  "
    assert present_day_beat(story) == "B last"


def test_present_day_beat_no_double_newline_returns_whole():
    assert present_day_beat("single block only") == "single block only"


def test_parse_json_verdicts():
    assert parse_payoff_verdict('{"verdict":"same_world","reason":"same tech"}') == (
        "same_world",
        "same tech",
    )
    assert parse_payoff_verdict('{"verdict":"different_world","reason":"no USA"}') == (
        "different_world",
        "no USA",
    )


def test_parse_strips_code_fences():
    raw = '```json\n{"verdict":"same_world","reason":"x"}\n```'
    assert parse_payoff_verdict(raw)[0] == "same_world"


def test_parse_keyword_fallback():
    assert parse_payoff_verdict("The present is a DIFFERENT world entirely.")[0] == "different_world"
    assert parse_payoff_verdict("Basically the same as ours.")[0] == "same_world"


def test_parse_prefers_different_when_both_words_present():
    # Mirror of TS: "different" is checked before "same".
    assert parse_payoff_verdict("not the same; a different world")[0] == "different_world"


def test_parse_unknown():
    assert parse_payoff_verdict("garbage with no keyword")[0] == "unknown"
