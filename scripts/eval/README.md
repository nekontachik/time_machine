# Time Machine — Trace Harness (error-analysis evals)

Built on Hamel Husain's eval methodology (https://hamel.dev/blog/posts/evals-faq/)
and Anthropic's "look at your data first" guidance.

**Goal:** generate ~100 *real* product traces, spread across the ways the product
is actually used, so you can read them and do **open coding** (free-text notes on
failure modes) → **axial coding** (group into a failure taxonomy) → and only THEN
build LLM-as-judge / automatic evals. This is deliberately NOT a metrics dashboard.
The existing `scripts/eval-harness.ts` (keyword accuracy, latency, structure) stays
as a cheap CI smoke test — it answers a different question.

## How it maps to Hamel's recipe

| Hamel step | Here |
|---|---|
| Define dimensions | `dimensions.ts` — Era, Historical Density, Counterfactual Complexity, Language |
| Write 20 tuples by hand | `tuples.ts` — 20 tuples targeting failure hypotheses |
| Convert tuples → queries (separate prompt) | `naturalize.ts` — 2-step draft → clean of the free-text "custom note" |
| Run through the real system | `runTraces.ts` — real `generateEventTitles` + real scenario prompt |
| Sample ~100 traces | 20 tuples × 5 runs = 100 → `out/traces.jsonl` |

## Faithfulness (why traces are "real")

The prompts and the `changes` string are imported from the **production** modules,
not re-implemented:

- `lib/ai/prompts.ts` — the exact event + scenario prompts (also used by `lib/ai/text.ts`)
- `lib/ai/changes.ts` — the exact toggle→`changes` string (also used by `app/api/scenario/route.ts`)

`_parity.ts` asserts the extracted prompts/string match the original inline text
byte-for-byte. Run it after touching prompts:

```
tsx --tsconfig scripts/eval/tsconfig.json scripts/eval/_parity.ts
```

## The 5 → 3 events fix (Counterfactual Complexity)

`generateEventTitles` now returns **3** events (was 5). If complexity were defined
by event *index*, peripheral vs central would blur. So complexity is re-anchored on
**impact tier** (the prompt sorts events high→medium→low):

- `peripheral` = remove the **lowest**-impact event
- `central`    = remove the **highest**-impact event
- `compound`   = remove the two highest
- `none`       = remove nothing (does the model still write a counterfactual?)
- `custom`     = remove highest + a naturalized user "what-if" note

`assertSeparable()` flags the degenerate case where all 3 events share one impact
tier (then the axis genuinely collapses and that trace is marked `separable.ok=false`
so you can re-roll or drop it).

## Run it

```bash
# Free dry-run: validates pipeline + coverage, no API key, no network
npm run eval:traces:dry

# Live: needs OPENROUTER_API_KEY in .env.local. ~100 calls to Gemini + Claude.
npm run eval:traces                 # 20 tuples × 5 runs = 100 traces
npm run eval:traces -- --runs 1     # smoke (20 traces)
npm run eval:traces -- --limit 3    # first 3 tuples only
```

Output: `out/traces.jsonl` (gitignored), one JSON object per line:
`{ traceId, tupleId, dims, year, lang, events, disabledIds, separable, customText, changes, output, latencyMs, totalTokens, paragraphCount }`

## Next: open coding

Read every trace and jot a short free-text note on anything wrong: anachronism,
hallucinated specifics, English leakage in a non-EN trace, broke the "2025 in this
timeline" frame, ignored the custom note, wrong paragraph count, narrated real
history instead of a counterfactual (`none`), incoherent cascade (`compound`).
Then group the notes into a taxonomy — that taxonomy is what your judges will score.
