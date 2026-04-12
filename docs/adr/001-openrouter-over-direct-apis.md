# ADR-001: OpenRouter Over Direct API SDKs

**Date:** 2025-12
**Status:** Accepted

## Context

Time Machine uses multiple AI models for different tasks: Gemini 2.0 Flash for event generation, Claude Sonnet for scenario narratives. The straightforward approach would be to install each provider's SDK (`@google/generative-ai`, `@anthropic-ai/sdk`) and call them directly.

## Decision

Use OpenRouter as a unified gateway for all text generation, via the OpenAI-compatible SDK.

```typescript
const client = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
});
```

## Rationale

- **Single API key, single billing dashboard.** Managing multiple provider accounts, billing alerts, and API keys adds operational overhead disproportionate to a solo project.
- **Model swapping without code changes.** Switching from `google/gemini-2.0-flash-001` to a different model is a one-line constant change. No SDK migration, no schema adapters.
- **OpenAI-compatible SDK.** The `openai` npm package works with OpenRouter's endpoint directly. No custom HTTP clients or bespoke wrappers needed.
- **Unified rate limit visibility.** OpenRouter's dashboard shows usage across all models in one place, making cost monitoring straightforward.

## Trade-offs

- **Additional latency:** ~50-100ms per request for the routing layer. Acceptable for this use case (users are already waiting for AI generation).
- **Vendor lock-in risk:** If OpenRouter has an outage, all text generation is affected. Mitigated by the fail-open architecture (ADR-002) — but a direct SDK fallback is not currently implemented.
- **Image generation excluded:** OpenRouter's image generation pricing was significantly higher than fal.ai direct. Images go through fal.ai instead (ADR-004).
