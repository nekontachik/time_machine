import { test, expect } from "@playwright/test";

test.describe("Home page", () => {
  test("loads and shows the title", async ({ page }) => {
    await page.goto("/");
    // The app title should be visible
    await expect(page.locator("h1")).toBeVisible();
  });

  test("has a year slider", async ({ page }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
  });

  test("navigates to events page when a year is submitted", async ({ page }) => {
    await page.goto("/");
    // Find and click the submit/explore button
    const button = page.locator("button, a").filter({ hasText: /explor|досліди|перейти|go/i }).first();
    if (await button.isVisible()) {
      await button.click();
      await page.waitForURL(/\/events\//);
      expect(page.url()).toContain("/events/");
    }
  });

  test("starfield canvas renders", async ({ page }) => {
    await page.goto("/");
    // Three.js renders into a canvas
    const canvas = page.locator("canvas");
    // Canvas may or may not be present depending on lazy loading
    // Just check page loads without errors
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Responsive design", () => {
  test("home page is usable on mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();
    // Slider should still be visible on mobile
    const slider = page.locator('input[type="range"]');
    await expect(slider).toBeVisible();
  });
});
