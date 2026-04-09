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
    await expect(yearDisplay).toContainText(/BC/);
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
      name: /Travel to/i,
    });

    await slider.fill("1969");
    await button.click();
    await page.waitForURL(/\/events\/1969/);
    expect(page.url()).toMatch(/lang=(ua|en)/);
  });

  test("submit button shows loading state after click", async ({ page }) => {
    await page.goto("/");
    const button = page.getByRole("button", {
      name: /Travel to/i,
    });

    await button.click();

    // Loading state: spinner and loading text
    await expect(
      page.getByText(/завантаження|loading/i)
    ).toBeVisible({ timeout: 1000 });
  });

  test("typing a future year and submitting shows inline error, does not navigate", async ({
    page,
  }) => {
    await page.goto("/");
    const numberInput = page.locator('input[type="number"]');
    const button = page.getByRole("button", { name: /Travel to/i });

    // Force a future year into the input bypassing the JS clamp (direct value set)
    await numberInput.evaluate((el: HTMLInputElement) => {
      el.value = "2099";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    // Directly trigger submit without relying on the clamped React state
    // The form submit handler must validate and block navigation
    await page.evaluate(() => {
      const form = document.querySelector("form");
      form?.requestSubmit();
    });

    // Error message should appear
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("alert")).toContainText(/year|рік/i);

    // URL must NOT have changed — still on homepage
    expect(page.url()).toMatch(/\/$/);
  });

  test("number input turns red border on invalid submit", async ({ page }) => {
    await page.goto("/");
    const numberInput = page.locator('input[type="number"]');

    await numberInput.evaluate((el: HTMLInputElement) => {
      el.value = "2099";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });

    await page.evaluate(() => {
      document.querySelector("form")?.requestSubmit();
    });

    // After failed submit, input should have red border class
    await expect(numberInput).toHaveClass(/border-red-500/);
  });

  test("error clears when user starts correcting the year", async ({ page }) => {
    await page.goto("/");
    const numberInput = page.locator('input[type="number"]');

    // Trigger error first
    await numberInput.evaluate((el: HTMLInputElement) => {
      el.value = "2099";
      el.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await page.evaluate(() => document.querySelector("form")?.requestSubmit());
    await expect(page.getByRole("alert")).toBeVisible();

    // Now type a valid year
    await numberInput.fill("1945");
    await expect(page.getByRole("alert")).not.toBeVisible();
  });
});
