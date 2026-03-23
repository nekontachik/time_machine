import { test, expect } from "@playwright/test";

test.describe("Year selection", () => {
  test("slider changes update displayed year in real-time", async ({ page }) => {
    await page.goto("/");
    const yearDisplay = page.locator(".text-7xl").first();
    const slider = page.locator('input[type="range"]');

    await expect(yearDisplay).toHaveText("1969");

    await slider.fill("1984");
    await expect(yearDisplay).toHaveText("1984");

    await slider.fill("0");
    await expect(yearDisplay).toHaveText("0");
  });

  test("number input changes update slider and display", async ({ page }) => {
    await page.goto("/");
    const yearDisplay = page.locator(".text-7xl").first();
    const numberInput = page.locator('input[type="number"]');
    const slider = page.locator('input[type="range"]');

    await numberInput.fill("1500");
    await expect(yearDisplay).toHaveText("1500");
    await expect(slider).toHaveValue("1500");
  });

  test("negative years display BCE format (UA or EN)", async ({ page }) => {
    await page.goto("/");
    const yearDisplay = page.locator(".text-7xl").first();
    const slider = page.locator('input[type="range"]');

    await slider.fill("-500");
    await expect(yearDisplay).toContainText("500");
    await expect(yearDisplay).toContainText(/до н\.е\.|BCE/);
  });

  test("boundary values: min -3000, max 2024, zero", async ({ page }) => {
    await page.goto("/");
    const yearDisplay = page.locator(".text-7xl").first();
    const slider = page.locator('input[type="range"]');

    await slider.fill("-3000");
    await expect(yearDisplay).toContainText("3000");

    await slider.fill("2024");
    await expect(yearDisplay).toHaveText("2024");

    await slider.fill("0");
    await expect(yearDisplay).toHaveText("0");
  });

  test("submit button navigates to correct events URL with lang param", async ({
    page,
  }) => {
    await page.goto("/");
    const slider = page.locator('input[type="range"]');
    const button = page.getByRole("button", {
      name: /переглянути події|view events/i,
    });

    await slider.fill("1969");
    await button.click();
    await page.waitForURL(/\/events\/1969/);
    expect(page.url()).toMatch(/lang=(ua|en)/);
  });

  test("submit button shows loading state after click", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", {
      name: /переглянути події|view events/i,
    });

    await button.click();

    // Loading state: spinner and loading text
    await expect(
      page.getByText(/завантаження|loading/i)
    ).toBeVisible({ timeout: 1000 });
  });
});
