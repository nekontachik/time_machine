"""Offline, self-contained byte-parity: the Python prompt == the TypeScript prompt,
checked by parsing payoffJudge.ts SOURCE directly (no tsx, no network, no fixtures).

This is the always-on guarantee that the frozen prompt was transported without
drift. If it fails, fix the Python port in payoff_judge_core.py — never edit the TS.
(test_prompt_parity.py is an optional, stronger runtime check against tsx output.)
"""
import os
import re

import pytest

from payoff_judge_core import build_payoff_prompt, year_label

TS_PATH = os.path.join(os.path.dirname(__file__), "..", "judges", "payoffJudge.ts")


def _ts_prompts(year: int, present: str):
    ts = open(TS_PATH, encoding="utf-8").read()
    sys_m = re.search(r'role:\s*"system",\s*content:\s*\n?\s*"((?:[^"\\]|\\.)*)"', ts)
    ts_system = bytes(sys_m.group(1), "utf-8").decode("unicode_escape")
    usr_m = re.search(r'role:\s*"user",\s*content:\s*`([\s\S]*?)`', ts)
    ts_user = re.sub(r"\$\{yearLabel\([\s\S]*?\)\}", year_label(year), usr_m.group(1))
    ts_user = ts_user.replace("${present}", present)
    return ts_system, ts_user


@pytest.mark.parametrize("year", [1969, -44, -3000, 2001])
def test_prompt_matches_ts_source(year):
    present = "In 2025 the world still runs on the same institutions as ours."
    ts_system, ts_user = _ts_prompts(year, present)
    py = build_payoff_prompt(year, present)
    assert py["messages"][0]["content"] == ts_system
    assert py["messages"][1]["content"] == ts_user
    assert py["max_tokens"] == 200
