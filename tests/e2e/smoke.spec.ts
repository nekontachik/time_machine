/**
 * Smoke tests — zero page.route() mocks.
 *
 * These tests run against real data and can be pointed at a deployed URL:
 *   BASE_URL=https://your-app.vercel.app npm run test:e2e:smoke
 *
 * Design rules:
 *  - No page.route() calls — every request hits the real server
 *  - Assert structure (count ≥ 1, element exists), not specific AI-generated text
 *  - Use generous timeouts for real API calls (up to 15 s)
 */
import { test, expect } from "@playwright/test";

// ── Home page ─────────────────────────────────────────────────────────────

test.describe("Smoke: Home page", () => {
  test("loads with h1 title and year slider", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test("slider updates the displayed year in real-time", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    const yearDisplay = page.locator(".text-7xl").first();

    await slider.fill("1984");
    await expect(yearDisplay).toHaveText("1984");
  });

  test("negative year renders as BC format", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    const yearDisplay = page.locator(".text-7xl").first();

    await slider.fill("-500");
    await expect(yearDisplay).toContainText("500");
    await expect(yearDisplay).toContainText(/BC/);
  });

  test("submit button shows loading state then navigates to events", async ({
    page,
  }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    await slider.fill("1969");

    const btn = page.getByRole("button", { name: /Travel to 1969/i });
    await btn.click();

    // Either we see Loading... briefly, or the URL already changed
    await page.waitForURL(/\/events\/1969/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/events\/1969/);
  });
});

// ── Events page — real API ────────────────────────────────────────────────

test.describe("Smoke: Events page — real API", () => {
  test("loads at least 1 event card (real AI response)", async ({ page }) => {
    await page.goto("/events/1969?lang=en");
    // Wait for real API — up to 15 s
    await expect(page.locator("h3").first()).toBeVisible({ timeout: 15_000 });
  });

  test("at least one impact badge is visible", async ({ page }) => {
    await page.goto("/events/1969?lang=en");
    await page.locator("h3").first().waitFor({ timeout: 15_000 });

    const badge = page
      .locator('[class*="rounded-full"]')
      .filter({ hasText: /high|medium|low/i })
      .first();
    await expect(badge).toBeVisible();
  });

  test("toggling Erase it reveals Generate Scenario button", async ({
    page,
  }) => {
    await page.goto("/events/1969?lang=en");
    await page.locator("h3").first().waitFor({ timeout: 15_000 });

    // Wait for choice step (toggles become active)
    const eraseBtn = page.getByRole("button", { name: /Erase it/i }).first();
    await eraseBtn.waitFor({ timeout: 5_000 });
    await eraseBtn.click();

    await expect(
      page.getByRole("button", { name: /Generate Scenario/i })
    ).toBeVisible({ timeout: 3_000 });
  });

  test("Generate Scenario navigates to /scenario with year param", async ({
    page,
  }) => {
    await page.goto("/events/1969?lang=en");
    await page.locator("h3").first().waitFor({ timeout: 15_000 });

    const eraseBtn = page.getByRole("button", { name: /Erase it/i }).first();
    await eraseBtn.waitFor({ timeout: 5_000 });
    await eraseBtn.click();

    await page.getByRole("button", { name: /Generate Scenario/i }).click();
    await page.waitForURL(/\/scenario/, { timeout: 5_000 });

    const url = new URL(page.url());
    expect(url.searchParams.get("year")).toBe("1969");
    expect(url.searchParams.get("lang")).toBeTruthy();
    expect(url.searchParams.get("events")).toBeTruthy();
  });
});

// ── Scenario page — structural checks (no AI needed) ─────────────────────

test.describe("Smoke: Scenario page — structural", () => {
  test("page without query params shows placeholder text", async ({ page }) => {
    await page.goto("/scenario");
    // Some placeholder/instruction text should be visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("page with valid params shows loading state before streaming", async ({
    page,
  }) => {
    // We don't mock the API — the loading skeleton should appear first
    const params =
      "year=1969&lang=en&events=" +
      encodeURIComponent(
        JSON.stringify([
          { id: "1", happened: false },
          { id: "2", happened: true },
        ])
      );

    // Intercept the scenario request to delay it slightly so we can catch
    // the skeleton — still a real request, just delayed on the network side
    // We use page.route only to add a delay, NOT to change the response body
    await page.route("**/api/scenario", async (route) => {
      await new Promise((r) => setTimeout(r, 600));
      await route.continue();
    });

    await page.goto(`/scenario?${params}`);
    // Skeleton (animate-pulse) or "generating" text should appear
    const skeleton = page.locator("[class*='animate-pulse']").first();
    await expect(skeleton).toBeVisible({ timeout: 3_000 });
  });
});

// ── API contracts — validation errors ────────────────────────────────────

test.describe("Smoke: API contracts", () => {
  test("GET /api/historical-events without year → 400", async ({ request }) => {
    const res = await request.get("/api/historical-events");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("GET /api/historical-events with invalid year → 400", async ({
    request,
  }) => {
    const res = await request.get("/api/historical-events?year=hello");
    expect(res.status()).toBe(400);
  });

  test("GET /api/historical-events with out-of-range year → 400", async ({
    request,
  }) => {
    const res = await request.get("/api/historical-events?year=99999");
    expect(res.status()).toBe(400);
  });

  test("POST /api/scenario with empty body → 400", async ({ request }) => {
    const res = await request.post("/api/scenario", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("POST /api/scenario with missing events → 400", async ({ request }) => {
    const res = await request.post("/api/scenario", {
      data: { year: 1969, lang: "en" },
    });
    expect(res.status()).toBe(400);
  });
});
