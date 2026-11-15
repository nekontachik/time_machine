# Time Machine — AI Alternative History PWA

## Stack
- **Framework**: Next.js 14.2 (App Router), TypeScript strict, Tailwind CSS
- **3D**: Three.js (StarField component, lazy-loaded)
- **AI Text**: OpenRouter API (`OPENROUTER_API_KEY`) — Gemini Flash Lite (events) + Claude Sonnet (scenarios); model ids in `constants/index.ts`
- **AI Images**: fal.ai → Flux 1 Schnell (`lib/ai/image.ts`, `buildFluxPrompt`)
- **Cache / Rate limit**: ioredis (`lib/infrastructure/redis-client.ts`)
- **i18n**: none — the product ships in English only (`LangSchema = z.enum(["en"])`)
- **Testing**: Vitest (unit/API) + Playwright (E2E)
- **CI**: GitHub Actions

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/historical-events` | GET | Top-3 events for year; Redis cache-first → OpenRouter |
| `/api/scenario` | POST | Streaming alternative history (ReadableStream) |
| `/api/image` | POST | Flux 1 Schnell image via fal.ai |
| `/api/test-flux` | POST | Dev-only endpoint (blocked in production) |
| `/api/health` | GET | Daily cron: Redis keep-alive + health check (CRON_SECRET) |
| `/api/monitoring` | POST | Sentry tunnel (forwards only to the project's own DSN) |
| `/api/admin/clear-cache` | POST | Dev-only events cache reset (404 in production) |

## Key Components
`YearSection/index.tsx` · `ScenarioStream/ScenarioStream.tsx` · `EventCard/EventCard.tsx`
`StarField/index.tsx` · `PremiumModal/PremiumModal.tsx`
`ShareCard/ShareCard.tsx` · `InstallPrompt/index.tsx` · `ServiceWorkerRegister/index.tsx`

## Server/Client Boundary Rules

1. Every file in lib/ that uses Node.js APIs (ioredis, fal-ai, openai)
   MUST have `import "server-only"` as the first line
2. Files: lib/ai/image.ts, lib/ai/text.ts, lib/infrastructure/redis-client.ts,
   lib/infrastructure/rate-limit.ts, lib/infrastructure/cache.ts,
   lib/validators.ts — all MUST start with `import "server-only"`
   (enforced by `npm run check:server-only` in pre-commit and CI)
3. Components with "use client" must NEVER import from lib/ directly —
   they communicate with server code only through API routes (fetch)
4. After ANY file change, run `rm -rf .next` before testing

## Key Lib Files
- `lib/ai/text.ts` — OpenRouter text generation (Gemini for events, Claude for scenarios)
- `lib/ai/image.ts` — fal.ai Flux image wrapper, exports `buildFluxPrompt`, `generateScenarioImage`
- `lib/ai/prompts.ts` — all prompts, shared with the eval harness (`scripts/eval/_parity.ts` guards parity)
- `lib/ai/search.ts` / `lib/tavily.ts` — Tavily search for event enrichment + Wikipedia links
- `lib/validators.ts` — zod request schemas (`.strict()`, length caps)
- `lib/infrastructure/redis-client.ts` — ioredis singleton with circuit breaker
- `lib/infrastructure/rate-limit.ts` — per-bucket daily limits, key `ratelimit:{bucket}:{ip}:{YYYY-MM-DD}`, TTL 24h;
  buckets scenario 10 / events 30 / image 10 (`BUCKET_LIMITS`, override via `RATE_LIMIT_{BUCKET}`);
  IPv6 is keyed on its /64 (`rateLimitKeyForIp`); `failClosed` option → 503 when Redis is down (prod only)
- `lib/infrastructure/cache.ts` — events cache wrapper (`EVENTS_CACHE_TTL_SECONDS`)

## Environment Variables
```
OPENROUTER_API_KEY=      # required — text generation (events + scenarios)
FAL_KEY=                 # required — image generation via fal.ai
REDIS_URL=               # required in prod — cache + rate limiting (all AI endpoints fail closed without it)
CRON_SECRET=             # required in prod — auth for the daily /api/health cron (Redis keep-alive)
RATE_LIMIT_SCENARIO=     # optional — overrides per-bucket daily limits
RATE_LIMIT_EVENTS=
RATE_LIMIT_IMAGE=
TAVILY_API_KEY=          # optional — event enrichment
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SENTRY_DSN=  # optional — error monitoring
SENTRY_AUTH_TOKEN=       # optional — source map upload (CI/Vercel only)
```

## Mock / Dev Flags
- `/api/test-flux`, `/api/admin/clear-cache`: return 404 in production
- Fail-closed rate limiting only applies when `NODE_ENV === 'production'`, so local dev works without Redis
- `REDTEAM_CANARY`: red-team eval only, never set in production

## Testing
```bash
npm test              # Vitest unit + API tests
npm run test:e2e      # Playwright E2E tests
npm run test:coverage # Vitest with coverage
```

## Conventions
- Server Components by default; `"use client"` only for Three.js, hooks, streaming
- All AI calls through `lib/` wrappers — never inline in components or routes
- All AI generation (text, image) through unified providers: OpenRouter + fal.ai
- Redis unavailable → /api/scenario, /api/image, /api/historical-events (and the /events/[year] SSR page) fail CLOSED in production (see ADR-002)
- /api/health (GET, Bearer CRON_SECRET) runs daily via Vercel Cron to keep the free Upstash DB from being archived for inactivity
