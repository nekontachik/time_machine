/**
 * Visual regression tests — screenshot comparison
 *
 * Playwright's built-in `toHaveScreenshot()` takes a reference screenshot
 * on first run and diffs subsequent runs against it.
 *
 * First run (generate baselines):
 *   npx playwright test visual --update-snapshots
 *
 * Subsequent runs (regression check):
 *   npm run test:e2e -- --grep "visual"
 *
 * Baselines are committed to git. If a change is intentional, update with:
 *   npx playwright test visual --update-snapshots
 */
import { test, expect } from "@playwright/test";

test.describe("Visual regression", () => {
  /**
   * Home page — star field, year slider, submit button
   * Snapshot captures the initial loading state before any interaction.
   */
  test("home page matches baseline", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    // Wait for any loading animations to settle
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot("home-page.png", {
      // Mask dynamic regions that change on every render
      mask: [page.locator("canvas")], // StarField renders randomly
      maxDiffPixelRatio: 0.02, // Allow 2% pixel difference
    });
  });

  /**
   * Events page — event cards with toggles
   */
  test("events page matches baseline", async ({ page }) => {
    // Use mock data for deterministic cards
    await page.goto("/events/1969?lang=en&e2e_mock=1");

    // Wait for cards to render
    await expect(page.locator("h2")).toBeVisible();

    await expect(page).toHaveScreenshot("events-page.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  /**
   * Events page dark (toggled) state
   */
  test("events page with toggled-off event matches baseline", async ({ page }) => {
    await page.goto("/events/1969?lang=en&e2e_mock=1");
    await expect(page.locator("h2")).toBeVisible();

    // Toggle the first event off
    const didNotHappenButtons = page.getByText(/did not happen/i);
    await didNotHappenButtons.first().click();

    await expect(page).toHaveScreenshot("events-page-toggled.png", {
      maxDiffPixelRatio: 0.02,
    });
  });

  /**
   * Scenario page — streaming text result
   */
  test("scenario page with loaded text matches baseline", async ({ page }) => {
    await page.route("**/api/scenario", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "In an alternate 1969, the space race took a different turn. Nations cooperated instead of competed, leading to a joint lunar mission unlike any other in history. The world watched as astronauts from three countries planted a single shared flag on the lunar surface.",
      })
    );
    // Prevent image request to avoid flakiness
    await page.route("**/api/image", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: '{"imageUrl":""}' })
    );

    const params = new URLSearchParams({
      year: "1969",
      lang: "en",
      events: JSON.stringify([{ id: "1", happened: false }]),
    });
    await page.goto(`/scenario?${params}`);

    // Wait for streaming to complete
    await expect(page.getByText("Nations cooperated")).toBeVisible({ timeout: 5000 });

    await expect(page).toHaveScreenshot("scenario-page.png", {
      maxDiffPixelRatio: 0.02,
    });
  });
});
