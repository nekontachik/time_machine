"""
Frozen payoff-judge core — a byte-for-byte Python port of the DETERMINISTIC parts
of scripts/eval/judges/payoffJudge.ts (+ scripts/eval/openrouter.ts).

This module is the single source of judge behavior for the Python side. It has NO
dependency on deepeval, so the frozen prompt / input-selection / verdict-parsing
can be unit-tested and byte-compared to the TypeScript original offline.

WHAT IS FROZEN (must match payoffJudge.ts exactly — do not "improve"):
  - present_day_beat()      == presentDayBeat()      (which paragraph is judged)
  - year_label()            == yearLabel()           (the {year} inside the prompt)
  - build_payoff_prompt()   == payoffJudgePrompt()   (system + user, char-for-char)
  - parse_payoff_verdict()  == parsePayoffVerdict()  (same_world/different_world/unknown)
  - call_openrouter()       == openrouter.ts         (model + max_tokens + messages,
                                                       NO temperature is ever sent)

MODEL: the calibrated judge (precision 92.9% / recall 100% vs evals1/payoff-review.md)
was measured with google/gemini-3.1-flash-lite (JUDGE_MODEL in .env.local, confirmed
in out/payoff-judge.md and EVALS.md). We read JUDGE_MODEL from the env exactly like
judgeModel() does; the ONLY intentional deviation from the TS default is that when
JUDGE_MODEL is unset we fall back to the *calibrated* model rather than SCENARIO_MODEL,
so the wrapper can never silently judge with a different model than the calibration.
"""
from __future__ import annotations

import json
import os
import re
from typing import Any, Dict, List, Tuple

import requests

# The model that produced the 92.9 / 100 calibration. Do not change.
CALIBRATED_JUDGE_MODEL = "google/gemini-3.1-flash-lite"

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

PayoffVerdict = str  # "same_world" | "different_world" | "unknown"


def judge_model() -> str:
    """Mirror of judgeModel(): process.env.JUDGE_MODEL || <calibrated>.

    (TS falls back to SCENARIO_MODEL; we fall back to the calibrated judge model
    instead — see module docstring. In practice .env.local sets JUDGE_MODEL, so
    both resolve to google/gemini-3.1-flash-lite.)
    """
    return os.environ.get("JUDGE_MODEL") or CALIBRATED_JUDGE_MODEL


def year_label(year: int) -> str:
    """Mirror of yearLabel(): negative years become '<n> BCE'."""
    return f"{abs(year)} BCE" if year < 0 else str(year)


def present_day_beat(output: str) -> str:
    """Mirror of presentDayBeat(): the last non-empty paragraph of the story.

    Human and judge see ONLY this beat, so calibration is apples-to-apples.
    """
    paras = [p.strip() for p in re.split(r"\n\n+", output)]
    paras = [p for p in paras if p]
    return paras[-1] if paras else output.strip()


# ---- The frozen prompt. Transcribed verbatim from payoffJudge.ts. --------------
# Any edit here (translation, shortening, "clarifying") breaks the calibration.

_SYSTEM = (
    "You evaluate an alternative-history story by ONE criterion: does the "
    "PRESENT-DAY (2025) world it describes meaningfully differ from our real "
    "2025? You only need to know our real present world. Reply with JSON only, "
    "no markdown."
)


def build_payoff_prompt(year: int, present: str, model: str | None = None) -> Dict[str, Any]:
    """Mirror of payoffJudgePrompt(). Returns {model, max_tokens, messages}.

    The user message is assembled from literal line-parts so the JSON example
    braces stay literal and only {year} / {present} are interpolated.
    """
    user_parts: List[str] = [
        f'This is the present-day ("2025 in this timeline") paragraph of an '
        f"alternative history whose divergence was set in the year "
        f"{year_label(year)}. A good alternative history ends in a present that "
        f"is meaningfully DIFFERENT from our real 2025.\n",
        "\n",
        "Classify this present-day world:\n",
        '- "same_world": the MATERIAL present is essentially OUR real 2025 — the '
        "same nations, institutions, technology level, and daily social order, "
        "with at most cosmetic differences. (Failure: a recap, or a divergence "
        "that fizzled back to our world.) A paragraph that describes our real "
        'present and then only muses about "what is missing" or a "road not '
        'taken" is STILL same_world — judge the present it actually describes, '
        "not the counterfactual it gestures at.\n",
        '- "different_world": the MATERIAL present is meaningfully different from '
        "our real 2025. This includes not only nations that don't exist / are "
        "missing or a different technology level, but ALSO a recognizably altered "
        "civilization — a different religious-intellectual order, materially "
        "altered core institutions (e.g. a differently-governed internet, a "
        "different linguistic/orthographic standard), or a materially different "
        "cultural landscape. Identical consumer technology (smartphones, the "
        'internet, streaming) does NOT by itself make a world "same_world" when '
        "its institutions or culture are materially altered.\n",
        "\n",
        "Compare only against our real present world. Ignore how plausible the "
        "path was.\n",
        "\n",
        'Return ONLY: {"verdict":"same_world"|"different_world","reason":"<one '
        'short sentence naming the concrete present-day detail that decided '
        'it>"}\n',
        "\n",
        "PRESENT-DAY PARAGRAPH:\n",
        '"""\n',
        f"{present}\n",
        '"""',
    ]
    return {
        "model": model or judge_model(),
        "max_tokens": 200,
        "messages": [
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": "".join(user_parts)},
        ],
    }


def parse_payoff_verdict(text: str) -> Tuple[PayoffVerdict, str]:
    """Mirror of parsePayoffVerdict(): JSON first, then a keyword fallback."""
    clean = re.sub(r"```json\n?|\n?```", "", text).strip()
    try:
        o = json.loads(clean)
        v = str(o.get("verdict", "")).lower()
        if v in ("same_world", "different_world"):
            return v, str(o.get("reason", "")).strip()
    except Exception:
        pass  # fall through
    low = clean.lower()
    if "different" in low:
        return "different_world", clean[:160]
    if "same" in low:
        return "same_world", clean[:160]
    return "unknown", clean[:160]


def call_openrouter(spec: Dict[str, Any], api_key: str, timeout: int = 60) -> str:
    """Mirror of openrouter.ts: send ONLY {model, max_tokens, messages}.

    No temperature is set — the TS harness does not send one, so we must not
    either (frozen call params).
    """
    res = requests.post(
        OPENROUTER_URL,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": spec["model"],
            "max_tokens": spec["max_tokens"],
            "messages": spec["messages"],
        },
        timeout=timeout,
    )
    if not res.ok:
        raise RuntimeError(f"OpenRouter {res.status_code}: {res.text}")
    data = res.json()
    choices = data.get("choices") or [{}]
    return (choices[0].get("message") or {}).get("content", "") or ""


def run_judge(present: str, year: int, api_key: str, model: str | None = None) -> Tuple[PayoffVerdict, str]:
    """Full judge call: frozen prompt -> OpenRouter -> parsed binary verdict."""
    spec = build_payoff_prompt(year, present, model=model)
    text = call_openrouter(spec, api_key)
    return parse_payoff_verdict(text)


# ---- env helpers ---------------------------------------------------------------

def repo_root() -> str:
    # scripts/eval/deepeval/ -> repo root is three levels up.
    return os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def load_repo_env() -> None:
    """Load OPENROUTER_API_KEY + JUDGE_MODEL from .env.local then .env, like runJudge.ts."""
    try:
        from dotenv import load_dotenv
    except Exception:
        return
    root = repo_root()
    load_dotenv(os.path.join(root, ".env.local"))
    load_dotenv(os.path.join(root, ".env"))


def require_api_key() -> str:
    key = os.environ.get("OPENROUTER_API_KEY")
    if not key:
        raise RuntimeError(
            "OPENROUTER_API_KEY not set. It lives in .env.local at the repo root; "
            "call load_repo_env() first, or export it."
        )
    return key
