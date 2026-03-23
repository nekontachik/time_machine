# Time Machine — AI Alternative History PWA

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
git clone <repo-url>
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

Tests cover:
- **lib/openai** — Flux prompt builder (era formatting, style keywords)
- **lib/motionPrompt** — scenario type detection, motion prompt generation, word limit
- **lib/video-providers/kling** — mock mode task lifecycle (create → poll → complete)
- **lib/rateLimit** — fail-open behavior, IP extraction from headers
- **lib/redis** — graceful fallback when Redis is unavailable
- **API routes** — input validation, error codes, rate limiting, premium gating

### E2E Tests (Playwright)

```bash
npm run test:e2e      # headless
npm run test:e2e:ui   # interactive UI
```

Tests cover:
- Home page rendering and navigation
- API contract validation (error codes, required fields)
- Responsive design (mobile viewport)

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/historical-events` | GET | Top-5 events for a year (Redis cache-first) |
| `/api/scenario` | POST | Streaming alternative history narrative |
| `/api/image` | POST | AI image generation (Flux via fal.ai) |
| `/api/video/create` | POST | Start video generation task (premium) |
| `/api/video/status` | GET | Poll video task status (premium) |

## Architecture

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
├── claude.ts               # OpenRouter text generation (server-only)
├── openai.ts               # fal.ai image generation (server-only)
├── redis.ts                # Redis cache client (server-only)
├── rateLimit.ts            # Per-IP rate limiting (server-only)
├── premium.ts              # Premium status check (server-only)
├── motionPrompt.ts         # Video motion prompt builder
└── video-providers/
    └── kling.ts            # Kling video via fal.ai (server-only)
```

**Server/Client Boundary:** All `lib/` files using Node.js APIs import `server-only`. Client components (`"use client"`) communicate with server code exclusively through API routes.

## License

MIT
