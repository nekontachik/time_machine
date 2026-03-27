# Time Machine — AI Alternative History PWA

[![CI](https://github.com/nekontachik/time_machine/actions/workflows/ci.yml/badge.svg)](https://github.com/nekontachik/time_machine/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-86%25-brightgreen)](./coverage/index.html)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://time-machine-mu.vercel.app/)

> 🌍 **[Try it live → time-machine-mu.vercel.app](https://time-machine-mu.vercel.app/)**

An AI-powered Progressive Web App that lets users explore alternative history scenarios. Pick a historical year, toggle which events happened or didn't, and get a vivid AI-generated narrative with cinematic imagery and video.

## Features

- **Year Explorer** — slider spanning 3000 BCE to 2024 CE with Three.js starfield animation
- **AI Event Generation** — top-5 events for any year via Gemini 2.0 Flash (OpenRouter)
- **Streaming Scenarios** — real-time alternative history narratives via Claude Sonnet (OpenRouter)
- **AI Image Generation** — cinematic scene images via Flux Schnell (fal.ai)
- **AI Video Generation** — image-to-video via Kling 2.0 (fal.ai), with mock mode for development
- **Rate Limiting** — per-IP daily limits with Redis, fail-open when Redis is unavailable
- **i18n** — Ukrainian and English via next-intl
- **PWA** — installable with offline support via service worker

## Lighthouse Scores

| Metric | Mobile | Desktop |
|--------|--------|---------|
| 🟢 Performance | **95** | **100** |
| 🟢 Accessibility | **93** | **93** |
| 🟢 Best Practices | **100** | **100** |
| 🟢 SEO | **100** | **100** |
| FCP | 1.4 s | 0.2 s |
| LCP | 2.4 s | 0.4 s |
| TBT | 0 ms | 10 ms |
| CLS | 0 | 0 |

_Measured with Lighthouse 13.0.1 via PageSpeed Insights · March 2026_

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript strict |
| Styling | Tailwind CSS |
| 3D | Three.js (lazy-loaded starfield) |
| AI Text | OpenRouter API (Gemini 2.0 Flash + Claude Sonnet) |
| AI Images | fal.ai (Flux Schnell) |
| AI Video | fal.ai (Kling 2.0 Master) |
| Cache | Redis (ioredis) |
| i18n | next-intl v3 |
| Testing | Vitest (unit/API) + Playwright (E2E) |
| CI | GitHub Actions |

## Getting Started

### Prerequisites

- Node.js 20+
- Redis instance (optional — app works without it, rate limiting is bypassed)

### Installation

```bash
git clone https://github.com/nekontachik/time_machine.git
cd time-machine
npm install
```

### Environment Variables

Copy the example and fill in your keys:

```bash
cp .env.local.example .env.local
```

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENROUTER_API_KEY` | Yes | Text generation (events + scenarios) |
| `FAL_KEY` | Yes | Image + video generation via fal.ai |
| `REDIS_URL` | No | Cache + rate limiting (fail-open without) |
| `RATE_LIMIT_FREE` | No | Free requests per day per IP (default: 3) |
| `NEXT_PUBLIC_APP_URL` | No | App URL for OG meta (default: http://localhost:3000) |
| `NEXT_PUBLIC_SENTRY_DSN` | No | Sentry error monitoring DSN |
| `SENTRY_AUTH_TOKEN` | No | Sentry source map upload (CI/Vercel only) |

### Development

```bash
npm run dev
# or clean start (removes .next cache):
npm run dev:clean
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

### Unit & API Tests (Vitest)

```bash
npm test              # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
```

200 tests across 22 files. Key areas covered:

- **lib/ai/image** — `FalAuthError` classification, retry logic, auth bail-out, placeholder fallback (98% coverage)
- **lib/ai/text** — event generation, context enrichment, streaming scenario output (100% coverage)
- **lib/ai/video-prompt** — scenario type detection, motion prompt generation, word limits
- **lib/video-providers/kling** — mock mode task lifecycle (create → poll → complete)
- **lib/infrastructure** — Redis fail-open, rate limiting, per-IP extraction
- **API routes** — input validation, error codes, rate limiting, premium gating
- **streamScenario** — chunk streaming, premium city/country context injection, empty stream handling

### E2E Tests (Playwright)

```bash
npm run test:e2e      # headless
npm run test:e2e:ui   # interactive UI
```

Tests cover:

- Home page rendering and navigation
- API contract validation (error codes, required fields)
- Accessibility audit (WCAG 2.1 AA via axe-core)
- Performance budgets (LCP, FCP, TBT thresholds)
- Responsive design (mobile viewport)

### Testing Strategy

This project uses AI providers (OpenRouter, fal.ai) for core functionality. The testing approach accounts for this:

- **External AI calls are mocked** — `lib/ai/text.ts` and `lib/ai/image.ts` are mocked at the API route level because calling real AI APIs in CI would be slow, expensive, and non-deterministic. This is intentional and reflected in the coverage report.
- **Pure logic is tested directly** — prompt builders (`buildFluxPrompt`, `buildMotionPrompt`), error normalisation, scenario type detection, and input validation are tested with real assertions.
- **Infrastructure gracefully degrades** — Redis, rate limiting, and premium checks are tested for fail-open behavior when dependencies are unavailable.
- **API contracts are validated at two levels** — Vitest tests mock the AI layer and verify route-level logic (validation, error codes, rate limiting). Playwright E2E tests hit the running server to verify HTTP contracts independently.

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/historical-events` | GET | Top-5 events for a year (Redis cache-first) |
| `/api/scenario` | POST | Streaming alternative history narrative |
| `/api/image` | POST | AI image generation (Flux via fal.ai) |
| `/api/video/create` | POST | Start video generation task (premium) |
| `/api/video/status` | GET | Poll video task status (premium) |

## Architecture

```mermaid
flowchart TD
    User(["👤 User"])

    subgraph Client ["Client (Browser / PWA)"]
        Slider["Year Slider\n(Three.js starfield)"]
        EventCards["Event Cards\n(toggle on/off)"]
        ScenarioUI["Scenario View\n(streaming text + image)"]
        PremiumModal["Premium Modal"]
    end

    subgraph Next ["Next.js Server (App Router)"]
        MW["Middleware\n(rate limit · premium check)"]
        EventsAPI["/api/historical-events"]
        ScenarioAPI["/api/scenario\n(ReadableStream)"]
        ImageAPI["/api/image"]
        VideoAPI["/api/video/create\n/api/video/status"]
    end

    subgraph External ["External Services"]
        Redis[("Redis\n(cache · rate limit)")]
        OR_Gemini["OpenRouter\nGemini 2.0 Flash"]
        OR_Claude["OpenRouter\nClaude Sonnet"]
        Flux["fal.ai\nFlux Schnell"]
        Kling["fal.ai\nKling 2.0 Master"]
    end

    User --> Slider --> EventCards --> ScenarioUI
    ScenarioUI -->|fetch| MW

    MW --> EventsAPI
    EventsAPI -->|cache-first| Redis
    Redis -->|cache miss| OR_Gemini
    OR_Gemini --> Redis

    MW --> ScenarioAPI
    ScenarioAPI -->|stream| OR_Claude

    MW --> ImageAPI
    ImageAPI --> Flux

    MW --> VideoAPI
    VideoAPI --> Kling
    ScenarioUI -->|premium flow| PremiumModal
```

**Server/Client Boundary:** All `lib/` files using Node.js APIs import `server-only`. Client components (`"use client"`) communicate with server code exclusively through API routes.

```
app/
├── api/                    # Server-side API routes
├── events/[year]/          # Dynamic events page (SSR + client)
├── scenario/               # Scenario display (streaming + image)
└── page.tsx                # Home (year slider + starfield)

components/
├── YearSection/            # Slider + Three.js starfield
├── ScenarioStream/         # Streaming text + image display
├── EventCard/              # Event toggle cards
└── ...                     # ShareCard, PremiumModal, i18n toggle

lib/
├── ai/
│   ├── text.ts             # OpenRouter text generation (server-only)
│   ├── image.ts            # fal.ai image generation (server-only)
│   ├── search.ts           # Tavily web search (server-only)
│   └── video-prompt.ts     # Motion prompt builder
├── infrastructure/
│   ├── redis-client.ts     # Redis cache client (server-only)
│   ├── rate-limit.ts       # Per-IP rate limiting (server-only)
│   └── cache.ts            # Event cache wrapper (server-only)
├── video-providers/
│   └── kling.ts            # Kling video via fal.ai (server-only)
├── premium.ts              # Premium status check (server-only)
└── formatYear.ts           # Year formatting utility
```

## License

MIT
