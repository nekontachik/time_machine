# ADR-004: Flux Schnell Over DALL-E for Image Generation

**Date:** 2026-01
**Status:** Accepted

## Context

The app generates cinematic historical scene images for each alternative history scenario. The initial plan was to use OpenRouter for everything (including images), but image generation through OpenRouter was significantly more expensive than going directly to specialized providers.

## Decision

Use fal.ai's Flux 1 Schnell model for image generation, bypassing OpenRouter for this task.

## Comparison

| Factor | DALL-E 3 (via OpenAI) | Flux Schnell (via fal.ai) |
|--------|-----------------------|---------------------------|
| Cost per image | ~$0.016 (1024×1792) | ~$0.003 |
| Generation time | 5-10 seconds | 1-3 seconds |
| Quality for historical scenes | High, but tends to refuse some prompts | Consistent, fewer content policy blocks |
| API complexity | REST, simple | Queue-based (subscribe), slightly more complex |
| Content policy | Strict — rejects some historical violence | More permissive for educational/historical content |

## Rationale

- **5× cost reduction per image.** At 100 requests/day, this saves ~$1.30/day ($39/month). For a portfolio project, every dollar matters.
- **Faster generation.** Users see the image 3-7 seconds sooner. Combined with text streaming, this makes the experience feel responsive.
- **Fewer content policy blocks.** Historical scenarios often involve wars, revolutions, and political figures. Flux Schnell generates these scenes more reliably than DALL-E 3, which sometimes refuses prompts about historical violence.
- **Same provider as video.** Both image and video generation go through fal.ai, simplifying billing and credential management.

## Trade-offs

- **fal.ai-specific SDK.** The `@fal-ai/client` package has its own patterns (queue subscribe, non-standard error objects). Required a custom error normalizer (`normalizeFalError`) because fal.ai can throw plain objects, fetch Responses, or non-standard values.
- **Less polish on some prompts.** DALL-E 3 has better text understanding for complex compositional prompts. Mitigated by the `buildFluxPrompt` helper that structures prompts for Flux's strengths.
