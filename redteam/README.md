# Time Machine — Red-Team & Safety Eval Suite

A product-specific safety evaluation of Time Machine's scenario pipeline, built
with [promptfoo](https://promptfoo.dev). This is a *find & measure* exercise on
our own product — not security research, and it contains no working exploits.

Full analysis and findings: **[VULN_TAXONOMY.md](./VULN_TAXONOMY.md)**.

## What's here

| File | Purpose |
|---|---|
| `promptfooconfig.smoke.yaml` | Free plumbing dry-run (echo provider, no cost). Validates the harness end-to-end. |
| `promptfooconfig.live.yaml` | Hand-written seed attacks against the live `/api/scenario`. Attack lands in `events[].title`. Safety-only llm-rubrics. |
| `promptfooconfig.judge.yaml` | Judge calibration: fabricated known-bad / known-safe outputs → measures the llm-rubric's TPR/TNR. |
| `promptfooconfig.redteam.yaml` | Auto-generation (`promptfoo redteam`): plugins × strategies fan-out. |
| `VULN_TAXONOMY.md` | Findings, three-bucket triage, calibration results, limitations. |
| `results-*.json` | Exported eval records (evidence). Large raw dumps are git-ignored. |

## How to run

Prereqs: `npm install -g promptfoo`, and a dev server with the canary marker:

```bash
set -a; source .env.local; set +a
REDTEAM_CANARY=CANARY_TM_7Q2X npm run dev      # drop REDIS_URL if you hit 429
```

Then, in another terminal (loads OPENROUTER_API_KEY for the judge):

```bash
set -a; source .env.local; set +a

# 1. smoke (free)
promptfoo eval -c redteam/promptfooconfig.smoke.yaml

# 2. live seed attacks
promptfoo eval -c redteam/promptfooconfig.live.yaml --no-cache

# 3. judge calibration (no server needed)
promptfoo eval -c redteam/promptfooconfig.judge.yaml --no-cache

# 4. auto-generated fan-out
promptfoo redteam run -c redteam/promptfooconfig.redteam.yaml --no-cache
promptfoo redteam report
```

## Headline result

Raw auto-gen ASR **15.6%** → triaged **≈4% real**, all low-severity (graphic
content, verbatim copyright). Every high-severity class and system-prompt
leakage held. ~half of raw "failures" were uncalibrated-grader artifacts.
Hand-written judge reached **TPR 100% / TNR 100%** after one adjudication cycle.

## Defensive change shipped alongside

The top code-level finding — `POST /api/scenario` accepting arbitrary
`events[].title` (client toggle UI is not a trust boundary) — is hardened by
`validateScenarioEvents()` in `lib/ai/changes.ts`, wired into the route and
covered by `tests/unit/scenario-validation.test.ts`. Defense-in-depth: it
enforces the request contract and caps payload size; injection resistance
itself is provided by the model + prompt structure (validated by this suite).

## The `REDTEAM_CANARY` env flag

`lib/ai/prompts.ts` plants a canary marker in the system prompt **only** when
`REDTEAM_CANARY` is set — production (unset) is unaffected. This makes
system-prompt leakage detectable with a cheap deterministic string match.
