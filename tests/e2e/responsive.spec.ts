import { test, expect } from "@playwright/test";

/**
 * Mobile-specific tests (@mobile).
 *
 * General UI tests (visibility of titles, buttons, cards) are already covered
 * by home.spec.ts, events-page.spec.ts, and scenario-page.spec.ts, which run
 * against BOTH projects (chromium + mobile) via playwright.config.ts.
 *
 * This file contains only tests that are genuinely mobile-unique:
 *   - no horizontal scroll (layout overflow)
 *   - tap target sizes (minimum 44 × 44 px)
 */

test.describe("Mobile-specific layout @mobile", () => {
  test("home page has no horizontal scroll", async ({ page }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("events page has no horizontal scroll", async ({ page }) => {
    await page.goto("/events/1969?lang=en&e2e_mock=1");
    await page.waitForSelector(".rounded-xl.border");
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });

  test("primary buttons meet minimum tap target size (44×44 px)", async ({
    page,
  }) => {
    await page.goto("/");
    const btn = page.getByRole("button", {
      name: /переглянути|view events/i,
    });
    const box = await btn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });

  test("event toggle buttons meet minimum tap target size (44×44 px)", async ({
    page,
  }) => {
    await page.goto("/events/1969?lang=en&e2e_mock=1");
    const cards = page.locator(".rounded-xl.border");
    await expect(cards.first()).toBeVisible();
    const toggleBtn = cards
      .first()
      .getByRole("button", { name: /не сталось|didn't happen/i });
    const box = await toggleBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  });
});
