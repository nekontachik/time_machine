# Time Machine — Cost Analysis

_Last updated: April 2026_

## Per-Request Cost Breakdown

A single user interaction (select year → view events → generate scenario with image) involves the following API calls:

| Step | Provider | Model | Tokens / Units | Cost |
|------|----------|-------|----------------|------|
| 1. Generate 3 events | OpenRouter | Gemini 2.0 Flash | ~512 output tokens | $0.00020 |
| 2. Tavily search (×3 events) | Tavily | Web Search | 3 queries | $0.00300 |
| 3. Enrich events (×3) | OpenRouter | Gemini 2.0 Flash | ~256 tokens × 3 | $0.00040 |
| 4. Find Wikipedia URLs (×3) | Tavily | Web Search | 3 queries | $0.00300 |
| 5. Stream scenario narrative | OpenRouter | Claude Sonnet 4.5 | ~2048 output tokens | $0.01800 |
| 6. Generate image | fal.ai | Flux Schnell | 1 image (16:9) | $0.00300 |
| **Total (free tier)** | | | | **~$0.028** |
| 7. Generate video (premium) | fal.ai | Kling 2.0 Turbo | 5s clip | ~$0.10 |
| **Total (premium)** | | | | **~$0.128** |

## Pricing Sources

| Provider | Pricing model | Rate |
|----------|--------------|------|
| OpenRouter → Gemini 2.0 Flash | Per token | $0.10 / 1M input, $0.40 / 1M output |
| OpenRouter → Claude Sonnet 4.5 | Per token | $3.00 / 1M input, $15.00 / 1M output |
| fal.ai → Flux Schnell | Per image | ~$0.003 / image |
| fal.ai → Kling 2.0 Turbo | Per video | ~$0.05-0.10 / 5s clip |
| Tavily | Per search | ~$0.001 / query (1000 free/month) |

## Cost Savings from Architecture Decisions

### 1. Redis Caching (~80% reduction on repeat requests)

Historical events for the same year are identical. Caching with 24h TTL means the second user to explore 1969 gets instant results at zero AI cost.

**Without cache:** 100 users × year 1969 = 100 AI calls = $2.80
**With cache:** 1 AI call + 99 cache hits = $0.028

### 2. Model Splitting (~60% reduction on text costs)

Using Gemini Flash for structured event generation instead of Claude Sonnet for everything:

**All Claude Sonnet:** $0.018 × 4 calls = $0.072 per request
**Split (Gemini events + Claude narrative):** $0.0006 + $0.018 = $0.019 per request

### 3. Flux over DALL-E (5× cheaper images)

**DALL-E 3:** ~$0.016 per image
**Flux Schnell:** ~$0.003 per image

## Projections

| Daily users | Requests/day | Monthly cost (text+image) | With caching |
|-------------|-------------|--------------------------|--------------|
| 10 | 30 | $25 | ~$8 |
| 100 | 300 | $250 | ~$50 |
| 1,000 | 3,000 | $2,500 | ~$300 |

_Assumptions: 3 requests/user/day (free limit), 70% cache hit rate for events, no video generation._

## Infrastructure Costs

| Service | Tier | Monthly cost |
|---------|------|-------------|
| Vercel | Hobby (free) | $0 |
| Redis (Upstash) | Free tier (10K commands/day) | $0 |
| Sentry | Developer (free) | $0 |
| Domain | — | $0 (using .vercel.app) |
| **Total fixed costs** | | **$0** |

## Measured Latency (Eval Harness, April 2026)

Real-world latency measured by `scripts/eval-harness.ts` against live providers:

| Operation | Provider | Measured latency |
|-----------|----------|-----------------|
| Event generation (3 events) | Gemini 2.0 Flash | **883ms** avg (680–1519ms range) |
| Scenario narrative | Claude Sonnet | **2893ms** |
| Scenario narrative | Gemini Flash | **781ms** (3.7× faster) |

Total user-perceived time for a full request (events + scenario + image): ~4-6 seconds. Streaming makes the scenario feel instant — text appears as it generates.

## Key Insight

The entire infrastructure runs on free tiers. The only variable cost is AI generation, and caching reduces this by ~80% for popular years. At current traffic levels (<50 users/day), the monthly AI cost is under $5.
