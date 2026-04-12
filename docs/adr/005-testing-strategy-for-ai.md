# ADR-005: Testing Strategy for Non-Deterministic AI Outputs

**Date:** 2026-01
**Status:** Accepted

## Context

Time Machine's core functionality relies on AI providers that return different outputs for the same input. You can't write `expect(response).toBe("The Roman Empire...")`. Traditional assertion-based testing breaks down when outputs are non-deterministic.

## Decision

Mock AI providers at the API route boundary. Test everything around the AI call — input validation, error handling, rate limiting, caching, streaming, prompt construction — with deterministic assertions.

## Implementation

### What IS tested directly (deterministic)

- **Prompt builders:** `buildFluxPrompt()`, `buildMotionPrompt()` are pure functions. Input → output is predictable and fully tested.
- **Error normalization:** `normalizeFalError()` handles all fal.ai error shapes (Error instances, plain objects, Responses). 98% coverage on `image.ts`.
- **Rate limiting logic:** Redis key format, TTL, counter increment, fail-open behavior when Redis is unavailable.
- **API route contracts:** Input validation (missing fields → 400), rate limit exceeded → 429, auth errors → 402.
- **Streaming:** Chunk encoding, empty stream handling, premium context injection into prompts.
- **Infrastructure:** Redis singleton, connection error circuit breaker, fail-open patterns.

### What is mocked (non-deterministic)

- `lib/ai/text.ts` — mocked at the route handler level. Tests verify the route calls the function with correct parameters, not what the AI returns.
- `lib/ai/image.ts` — mocked to return a predictable URL. Tests verify retry logic, auth error bail-out, and placeholder fallback.

### CI pipeline

9 parallel jobs on every push: lint, type check, `server-only` boundary check, production build, component tests, unit tests, E2E desktop, E2E mobile (iPhone 14 viewport), and summary gate.

## Rationale

- **86% coverage, 273 tests** — high confidence in the deterministic parts without fragile AI output assertions.
- **100% coverage on text.ts and image.ts error paths** — the most likely failure points are the most thoroughly tested.
- **E2E tests use axe-core** for WCAG 2.1 AA accessibility audits and performance budgets (LCP, FCP, TBT thresholds).
- **QA background influence:** The testing approach reflects quality engineering principles — test the boundaries, contracts, and failure modes rather than trying to verify the content of creative output.

## Evaluation Harness Results (April 2026)

The `scripts/eval-harness.ts` script tests real AI output quality against a benchmark of 10 historically significant years:

| Metric | Result |
|--------|--------|
| Event keyword accuracy | 93.0% (10 years) |
| Structure compliance (valid JSON) | 10/10 |
| Average event latency (Gemini Flash) | 883ms |
| Claude Sonnet scenario: chars / paragraphs / readability | 2383 / 4 / 26.7 wps |
| Gemini Flash scenario: chars / paragraphs / readability | 2048 / 3 / 16.9 wps |
| Gemini Flash scenario latency | 781ms (3.7× faster than Claude) |

Key finding: Claude produces richer narratives but occasionally exceeds structure constraints (4 paragraphs instead of 3). Gemini follows instructions precisely. This data validates the model-splitting architecture.

## Trade-offs

- **AI output quality is not automatically validated in CI.** The eval harness requires live API keys and is run manually before deployments, not in the CI pipeline (to avoid costs and non-deterministic failures). A model update causing worse quality would be caught on the next manual eval run.
- **Keyword matching underreports accuracy.** The 93% score uses exact keyword matching (e.g., looking for "moon"), but the model may use synonyms ("lunar landing"). Semantic matching would yield higher accuracy.
- **Mocking can hide integration issues.** Mitigated by E2E tests that hit the running server, and by manual smoke testing against real providers before deployment.
