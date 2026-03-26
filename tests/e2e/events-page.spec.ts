import { test, expect } from "@playwright/test";

const EVENTS_URL = "/events/1969?lang=en&e2e_mock=1";

test.describe("Events page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENTS_URL);
    // Wait for the year-reveal overlay to finish and cards to appear
    await page.locator("h3").first().waitFor({ timeout: 8000 });
  });

  test("all 5 event cards render with titles, descriptions, impact badges", async ({
    page,
  }) => {
    const cards = page.locator("h3");
    await expect(cards).toHaveCount(5);

    await expect(page.getByText("Moon Landing")).toBeVisible();
    await expect(page.getByText("Woodstock Festival")).toBeVisible();
    await expect(page.getByText("ARPANET")).toBeVisible();
    await expect(page.getByText("Concorde Flight")).toBeVisible();
    await expect(page.getByText("Stonewall Riots")).toBeVisible();

    await expect(page.getByText("high").first()).toBeVisible();
    await expect(page.getByText("medium").first()).toBeVisible();
    await expect(page.getByText("low").first()).toBeVisible();
  });

  test("all events default to happened state (Keep it button active/indigo)", async ({
    page,
  }) => {
    const keepButtons = page.getByRole("button", { name: /Keep it/i });
    await expect(keepButtons).toHaveCount(5);

    const firstCard = page.locator(".rounded-2xl.border").first();
    const keepBtn = firstCard.getByRole("button", { name: /Keep it/i });
    await expect(keepBtn).toHaveClass(/indigo/);
  });

  test("clicking Erase it toggles card to dimmed/red state", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-2xl.border").first();
    const eraseBtn = firstCard.getByRole("button", { name: /Erase it/i });

    await eraseBtn.click();

    // Card gets dimmed (opacity-70) and red border
    await expect(firstCard).toHaveClass(/opacity-70|red/);
    await expect(eraseBtn).toHaveClass(/red/);
  });

  test("clicking Keep it toggles back to normal state", async ({ page }) => {
    const firstCard = page.locator(".rounded-2xl.border").first();
    const eraseBtn = firstCard.getByRole("button", { name: /Erase it/i });
    const keepBtn = firstCard.getByRole("button", { name: /Keep it/i });

    await eraseBtn.click();
    await keepBtn.click();

    await expect(keepBtn).toHaveClass(/indigo/);
  });

  test("generate button is not visible when all events are happened", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /Generate Scenario/i })
    ).not.toBeVisible();
  });

  test("generate button appears when at least one event is erased", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-2xl.border").first();
    const eraseBtn = firstCard.getByRole("button", { name: /Erase it/i });

    await eraseBtn.click();

    await expect(
      page.getByRole("button", { name: /Generate Scenario/i })
    ).toBeVisible();
  });

  test("generate button disappears when all toggled back to happened", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-2xl.border").first();
    const eraseBtn = firstCard.getByRole("button", { name: /Erase it/i });
    const keepBtn = firstCard.getByRole("button", { name: /Keep it/i });

    await eraseBtn.click();
    await expect(
      page.getByRole("button", { name: /Generate Scenario/i })
    ).toBeVisible();

    await keepBtn.click();
    await expect(
      page.getByRole("button", { name: /Generate Scenario/i })
    ).not.toBeVisible();
  });

  test("generate button click navigates to scenario with correct query params", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-2xl.border").first();
    const eraseBtn = firstCard.getByRole("button", { name: /Erase it/i });

    await eraseBtn.click();

    const generateBtn = page.getByRole("button", { name: /Generate Scenario/i });
    await generateBtn.click();

    await page.waitForURL(/\/scenario/);
    const url = new URL(page.url());
    expect(url.searchParams.get("year")).toBe("1969");
    expect(url.searchParams.get("lang")).toBeTruthy();
    expect(url.searchParams.get("events")).toBeTruthy();
  });

  test("impact badges have correct color classes (high=red, medium=yellow, low=blue)", async ({
    page,
  }) => {
    const highBadges = page.getByText("high", { exact: true });
    const mediumBadges = page.getByText("medium", { exact: true });
    const lowBadges = page.getByText("low", { exact: true });

    await expect(highBadges.first()).toHaveClass(/red/);
    await expect(mediumBadges.first()).toHaveClass(/yellow/);
    await expect(lowBadges.first()).toHaveClass(/blue/);
  });
});
