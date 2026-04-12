# ADR-003: Redis Caching Strategy

**Date:** 2025-12
**Status:** Accepted

## Context

Historical events for a given year are deterministic — the Battle of Hastings happened in 1066 every time you ask. But each AI generation call costs money (~$0.0006 for events via Gemini Flash) and takes 1-3 seconds. If 50 users explore the year 1969 in one day, that's 50 identical AI calls.

## Decision

Cache historical events in Redis with a 24-hour TTL. Cache key format: `events:{year}:{lang}`.

## Implementation

- **Cache-first pattern.** The `/api/historical-events` route checks Redis first. On cache hit, return immediately (0ms AI cost). On cache miss, generate via AI, store result, return.
- **24-hour TTL.** Events are stored for 24 hours (`EVENTS_CACHE_TTL_SECONDS = 86400`). This balances freshness (AI model improvements) with cost savings.
- **Rate limiting uses same Redis instance.** Keys: `ratelimit:{ip}:{YYYY-MM-DD}` with 24h TTL. One connection, two use cases.
- **Shared singleton client.** All infrastructure modules (`cache.ts`, `rate-limit.ts`, `premium.ts`) share one Redis connection via `getRedisClient()`, avoiding duplicate sockets.

## Rationale

- **~80% cost reduction on repeat requests.** Popular years (1969, 1945, 1492) are requested disproportionately often.
- **Sub-50ms response for cached events.** vs 1-3 seconds for fresh AI generation.
- **Simple invalidation.** TTL-based expiry — no manual cache busting needed. If the AI model improves, users see better results within 24 hours.

## Trade-offs

- **Staleness.** If the AI model generates a better event list, cached users see the old version for up to 24 hours. Acceptable for historical content.
- **Redis dependency.** Mitigated by fail-open pattern (ADR-002) — the app works without Redis, just slower and more expensive.
- **No per-user personalization of events.** Events are cached per year+language, not per user. This is intentional — historical events are the same for everyone.
