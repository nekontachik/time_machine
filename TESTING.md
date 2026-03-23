# Testing Strategy — Time Machine

> QA documentation for the Time Machine AI alternative history PWA.
> Stack: **Vitest** (unit + API) · **Playwright** (E2E) · **TypeScript strict**

---

## Table of Contents

1. [Test Pyramid](#test-pyramid)
2. [Running Tests](#running-tests)
3. [Unit Tests](#unit-tests)
4. [API Tests](#api-tests)
5. [E2E Tests](#e2e-tests)
6. [Test Fixtures & Mocking Strategy](#test-fixtures--mocking-strategy)
7. [Coverage](#coverage)
8. [CI Pipeline](#ci-pipeline)
9. [Planned Additions](#planned-additions)
10. [Known Gaps & Risk Areas](#known-gaps--risk-areas)

---

## Test Pyramid

```
         ┌─────────────────────┐
         │     E2E Tests       │  7 specs × 2 browsers
         │  (Playwright)       │  Slow, high confidence
         ├─────────────────────┤
         │    API Tests        │  5 suites (routes + contracts)
         │  (Vitest + fetch)   │  Medium speed, route-level
         ├─────────────────────┤
         │    Unit Tests       │  5 suites, 30+ assertions
         │    (Vitest)         │  Fast, pure logic
         └─────────────────────┘
```

| Layer | Files | Tests | Run time |
|-------|-------|-------|----------|
| Unit | `__tests__/unit/` | 20 | ~200 ms |
| API | `__tests__/api/` | 30 | ~800 ms |
| E2E | `__tests__/e2e/` | 7 specs | ~60 s |
| **Total** | **10 files** | **55** | **~2.7 s** (unit+API) |

---

## Running Tests

```bash
# Unit + API (fast, no browser)
npm test

# With coverage report
npm run test:coverage

# Watch mode during development
npm run test:watch

# E2E (requires dev server — playwright starts it automatically)
npm run test:e2e

# E2E desktop only (Chromium)
npm run test:e2e:desktop

# E2E mobile only (Pixel 5 viewport)
npm run test:e2e:mobile

# E2E interactive UI
npm run test:e2e:ui
```

---

## Unit Tests

Located in `__tests__/unit/`.

| File | What is tested |
|------|----------------|
| `buildFluxPrompt.test.ts` | Flux image prompt builder — era labels, cinematic keywords, BC/AD formatting |
| `motionPrompt.test.ts` | Kling video motion prompt — scenario type detection, word count cap, era context |
| `rateLimit.test.ts` | Rate-limit helpers — fail-open with no Redis, IP extraction from headers |
| `redis.test.ts` | Cache layer — graceful null returns when Redis is unavailable |
| `videoProvider.test.ts` | Kling provider mock mode — task creation, 3-poll completion cycle |

### Patterns used

- **Env stubbing** (`vi.stubEnv`) to simulate missing services
- **Dynamic imports** (`await import(...)`) to pick up env stubs before module init
- **Module reset** (`vi.resetModules()`) between tests to prevent singleton pollution
- **Mock mode testing**: video provider tests run entirely without FAL_KEY

---

## API Tests

Located in `__tests__/api/`.

| File | Route tested | Key scenarios |
|------|-------------|---------------|
| `events.test.ts` | `GET /api/historical-events` | Missing year (400), out-of-range (400), negative BCE year (200), cache miss path |
| `scenario.test.ts` | `POST /api/scenario` | Invalid JSON (400), missing fields (400), streaming response (200), rate limit (429) |
| `image.test.ts` | `POST /api/image` | Missing fields (400), successful image URL response |
| `video.test.ts` | `POST /api/video/create`, `GET /api/video/status` | Invalid duration (400), premium gate (403), mock task lifecycle |
| `api-contracts.test.ts` | All routes | Response shape contracts — required fields, correct HTTP codes |

### Mocking strategy

All external dependencies are mocked at the module level:

```typescript
// Mock AI text provider
vi.mock("@/lib/ai/text", () => ({
  generateEvents: vi.fn().mockResolvedValue([...MOCK_EVENTS]),
}));

// Mock cache
vi.mock("@/lib/infrastructure/cache", () => ({
  getCachedEvents: vi.fn().mockResolvedValue(null),
  setCachedEvents: vi.fn().mockResolvedValue(undefined),
}));
```

No real HTTP calls — tests run without `OPENROUTER_API_KEY` or `FAL_KEY`.

---

## E2E Tests

Located in `__tests__/e2e/`. Run via Playwright against `http://localhost:3000`.

| Spec | Scenarios |
|------|-----------|
| `home.spec.ts` | Title visible, slider present, navigation to events page, canvas renders |
| `events-page.spec.ts` | Events load, toggles work, generate button appears after toggle |
| `year-selection.spec.ts` | Slider interaction, number input, BCE year navigation |
| `scenario-page.spec.ts` | Loading skeleton, streaming text, error state (red box), back link, image after stream |
| `language-toggle.spec.ts` | Toggle switches language, persists in cookie, labels change |
| `responsive.spec.ts` | Mobile viewport layout, touch interactions |
| `api-contracts.spec.ts` | Real API request/response validation in browser context |

### Mock API helpers (`__tests__/e2e/helpers/mock-api.ts`)

E2E tests mock network requests using Playwright's `page.route()`:

```typescript
// Intercept and stub scenario API
await mockScenarioAPI(page, "Alternative text...");

// Simulate API error
await mockScenarioAPIError(page, 500);

// Mock image response
await mockImageAPI(page, "https://example.com/test.jpg");
```

Real AI calls are never made during E2E — responses are deterministic.

---

## Test Fixtures & Mocking Strategy

### Shared fixtures (`__tests__/fixtures/events.ts`)

`MOCK_EVENTS` provides 5 deterministic historical events used across:
- Unit tests that need event data
- API tests (via `vi.mock`)
- E2E tests (via `E2E_MOCK_EVENTS=true` env or `e2e_mock_events=1` cookie)

### Server-only mock (`__tests__/__mocks__/server-only.ts`)

Vitest runs in a Node environment, not the Next.js server environment. The `server-only` package throws at import time if used in a client context. The manual mock bypasses this:

```typescript
// __tests__/__mocks__/server-only.ts
export default {};
```

---

## Coverage

Generate a full coverage report:

```bash
npm run test:coverage
# Opens coverage/index.html
```

Current coverage targets (enforced in `vitest.config.ts`):

| Metric | Target |
|--------|--------|
| Statements | 70% |
| Branches | 60% |
| Functions | 70% |
| Lines | 70% |

**Not covered by automated tests (intentional or future work):**
- `lib/video-providers/kling.ts` — real fal.ai queue calls (network-dependent)
- `app/layout.tsx` — Next.js root layout (tested via E2E)
- PWA service worker (`public/sw.js`) — browser-only

---

## CI Pipeline

Defined in `.github/workflows/ci.yml`. Five parallel jobs run on every push/PR:

| Job | What it does |
|-----|-------------|
| `lint` | ESLint — code quality |
| `type-check` | `tsc --noEmit` — TypeScript strict check |
| `unit-tests` | Vitest unit + API suite |
| `e2e-desktop` | Playwright Chromium (1280×720) |
| `e2e-mobile` | Playwright Pixel 5 viewport |

All jobs run with empty `FAL_KEY`, `REDIS_URL`, and `OPENROUTER_API_KEY` — no real API keys needed in CI.

---

## Planned Additions

### High priority

- [ ] **Accessibility audit** (`__tests__/e2e/accessibility.spec.ts`)
  Run `@axe-core/playwright` on each page. Assert zero WCAG AA critical violations.

- [ ] **Visual regression tests** (`__tests__/e2e/visual.spec.ts`)
  Playwright screenshot comparison for key pages. Catch unintended UI regressions.

- [ ] **Performance budget** (`__tests__/e2e/performance.spec.ts`)
  Use `page.metrics()` or Lighthouse integration to assert LCP < 2.5 s on home page.

- [ ] **Input validation fuzz tests** (`__tests__/unit/validation.test.ts`)
  Property-based testing of year boundaries: `-3000`, `-3001`, `0`, `2024`, `2025`, NaN, `null`, very large numbers, strings.

### Medium priority

- [ ] **Streaming abort test** — verify `AbortController` in `ScenarioStream` properly cancels in-flight requests

- [ ] **Rate limit with Redis** — integration test using `ioredis-mock` to assert counter increments and TTL expiry

- [ ] **i18n completeness** — test that all translation keys in `en.json` exist in `uk.json` (and vice versa)

- [ ] **PWA manifest validation** — verify `public/manifest.json` has required fields and icon sizes

### Low priority (nice to have)

- [ ] **Storybook** — interactive component catalog for `EventCard`, `ScenarioStream`, `PremiumModal`
- [ ] **Contract testing (Pact)** — consumer-driven contracts for `generateEvents` / `streamScenario` API shape
- [ ] **Load test** — k6 script simulating 50 concurrent users hitting `/api/scenario`

---

## Known Gaps & Risk Areas

| Area | Risk | Mitigation |
|------|------|------------|
| Redis singleton | Three modules shared one client — now unified in `lib/infrastructure/redis-client.ts` | Single point of failure; monitor error events |
| Streaming SSE | `ScenarioStream` uses raw `ReadableStream`, not Vercel AI SDK | Harder to test chunks; abort behavior needs manual test |
| Image fallback | `generateScenarioImage` silently returns placeholder on any error | Test that placeholder path includes correct era string |
| Premium gate | IP-based Redis key — spoofable via proxy | Acceptable for demo; not production-grade |
| Year validation | API allows `year=2024` but UI labels it as "present" | Max year `2024` hardcoded in two places → constants/index.ts now centralizes it |
| fal.ai config | `fal.config()` called in `lib/ai/image.ts` and `lib/video-providers/kling.ts` | Double-init is harmless but could be unified in an `initFal()` utility |

---

*Last updated: March 2026 — After project restructuring (lib/ai/, lib/infrastructure/, constants/)*
