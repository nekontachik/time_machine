# Time Machine — AI Alternative History PWA

## Stack
- **Framework**: Next.js 14.2 (App Router), TypeScript strict, Tailwind CSS
- **3D**: Three.js (StarField component, lazy-loaded)
- **AI Text**: OpenRouter API (`OPENROUTER_API_KEY`) — claude-sonnet-4-20250514 via OpenRouter
- **AI Images**: OpenRouter → Flux 1 Schnell (`lib/openai.ts`, `buildFluxPrompt`)
- **AI Video**: Kling AI via kie.ai proxy (`lib/video-providers/kling.ts`)
- **Cache / Rate limit**: ioredis (`lib/redis.ts`)
- **i18n**: next-intl v3.26.3 — `messages/uk.json` + `messages/en.json`; config in `i18n.ts`

## API Routes
| Route | Method | Purpose |
|---|---|---|
| `/api/events` | GET | Top-5 events for year; Redis cache-first → OpenRouter |
| `/api/scenario` | POST | Streaming alternative history (ReadableStream) |
| `/api/image` | POST | Flux 1 Schnell image via OpenRouter |
| `/api/test-flux` | POST | Dev endpoint to test Flux directly |
| `/api/video/create` | POST | Start Kling video task |
| `/api/video/status` | GET | Poll Kling task status |

## Key Components
`YearSection/index.tsx` · `ScenarioStream/ScenarioStream.tsx` · `EventCard/EventCard.tsx`
`StarField/index.tsx` · `LanguageToggle/index.tsx` · `PremiumModal/PremiumModal.tsx`
`ShareCard/ShareCard.tsx` · `InstallPrompt/index.tsx` · `ServiceWorkerRegister/index.tsx`

## Key Lib Files
- `lib/openai.ts` — Flux image wrapper, exports `buildFluxPrompt`
- `lib/claude.ts` — Anthropic SDK wrapper (kept for direct use if needed)
- `lib/rateLimit.ts` — Redis key `ratelimit:{ip}:{YYYY-MM-DD}`, TTL 24h; limit = `RATE_LIMIT_FREE` env (default 3)
- `lib/redis.ts` — ioredis client; Redis also holds `premium:{ip}` keys
- `lib/motionPrompt.ts` — builds video motion prompt for Kling
- `lib/video-providers/kling.ts` — `USE_MOCK = !KLING_API_KEY`; mock returns fake taskId, simulates 3-poll completion

## Environment Variables
```
OPENROUTER_API_KEY=      # required — text + image generation
REDIS_URL=               # required — cache + rate limiting
KLING_API_KEY=           # optional — absent → USE_MOCK=true in kling.ts
KLING_API_SECRET=        # optional — for official Kuaishou endpoint JWT
RATE_LIMIT_FREE=         # optional — free req/day limit (default 3)
STRIPE_SECRET_KEY=       # Phase 3
STRIPE_WEBHOOK_SECRET=   # Phase 3
LIQPAY_PUBLIC_KEY=       # Phase 3
LIQPAY_PRIVATE_KEY=      # Phase 3
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Mock / Dev Flags
- `USE_MOCK` in `kling.ts`: `true` when `KLING_API_KEY` missing
- `SKIP_PREMIUM`: `true` when `NODE_ENV === 'development'`

## Known TODOs
- `useTranslations()` from next-intl not yet wired into most components (messages/ files exist but unused)
- Legacy `i18n/ua.json` + `i18n/en.json` flat files — superseded by `messages/`
- PWA service worker not yet active (ServiceWorkerRegister component exists)
- `next.config.mjs` remote image pattern: `oaidalleapiprodscus.blob.core.windows.net` (Azure BLOB for DALL·E)

## Conventions
- Server Components by default; `"use client"` only for Three.js, hooks, streaming
- All AI calls through `lib/` wrappers — never inline in components or routes
- Redis unavailable → rate limit silently bypassed (fail-open)
