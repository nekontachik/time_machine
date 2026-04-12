# ADR-002: Fail-Open Architecture

**Date:** 2025-12
**Status:** Accepted

## Context

Time Machine depends on four external services: OpenRouter (text), fal.ai (images + video), Redis (cache + rate limiting), and Tavily (web search for enrichment). Any of these can fail — and in practice, they did. Redis timed out during Vercel cold starts. fal.ai returned 402 when billing limits were silently reached. OpenRouter rejected requests when account credits hit zero despite a valid API key.

## Decision

Every external dependency fails open. The app always shows something useful to the user, even when backends are degraded.

## Implementation

| Dependency | Failure mode | Fallback |
|------------|-------------|----------|
| Redis | Connection timeout or missing `REDIS_URL` | Rate limiting bypassed; events served fresh from AI |
| fal.ai image | Auth/billing error (402/403) | Return era-appropriate placeholder image |
| fal.ai image | Timeout or transient error | Retry once, then placeholder |
| OpenRouter | Stream interrupted | Show whatever text has already arrived |
| Tavily search | Any error | Use original AI-generated event description (no enrichment) |

The Redis client implements a singleton pattern with a permanent circuit breaker: once a connection error occurs, `redisUnavailable` is set to `true` and all subsequent calls return `null` immediately, avoiding repeated connection attempts.

```typescript
export function getRedisClient(): Redis | null {
  if (redisUnavailable) return null;
  // ...
}
```

## Rationale

- **User experience over correctness.** A user exploring alternative history for fun would rather see a placeholder image than an error page. The AI-generated text is the core value — images and caching are enhancements.
- **Production reality.** External services fail in ways their documentation doesn't cover. The billing-related 402 from fal.ai was classified as `FalAuthError` to prevent futile retries — auth errors won't be fixed by trying again.
- **Cost protection.** If Redis is down, bypassing rate limits is better than blocking all users. The risk of a few extra free requests is small compared to a complete outage.

## Trade-offs

- **Silent degradation.** Users might not notice reduced quality (placeholder images, uncached responses). Sentry tags `ai_provider_error: true` on provider failures so we can monitor degradation rates.
- **Cost spikes possible.** If Redis cache is down for an extended period, every request triggers fresh AI generation. Monitoring AI provider costs becomes important.
