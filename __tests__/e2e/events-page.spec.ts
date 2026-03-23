import { test, expect } from "@playwright/test";

const EVENTS_URL = "/events/1969?lang=ua&e2e_mock=1";

test.describe("Events page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(EVENTS_URL);
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

  test("all events default to happened state (indigo button active)", async ({
    page,
  }) => {
    const happenedButtons = page.getByRole("button", {
      name: /сталось|happened/i,
    });
    await expect(happenedButtons).toHaveCount(5);
    const firstCard = page.locator(".rounded-xl.border").first();
    const happenedBtn = firstCard.getByRole("button", {
      name: /сталось|happened/i,
    });
    await expect(happenedBtn).toHaveClass(/indigo/);
  });

  test("clicking didn't happen toggles card to dimmed/red state", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-xl.border").first();
    const didntHappenBtn = firstCard.getByRole("button", {
      name: /не сталось|didn't happen/i,
    });

    await didntHappenBtn.click();

    // Card gets dimmed (opacity-70) and red border
    await expect(firstCard).toHaveClass(/opacity-70|red/);
    await expect(didntHappenBtn).toHaveClass(/red/);
  });

  test("clicking happened toggles back to normal state", async ({ page }) => {
    const firstCard = page.locator(".rounded-xl.border").first();
    const didntHappenBtn = firstCard.getByRole("button", {
      name: /не сталось|didn't happen/i,
    });
    const happenedBtn = firstCard.getByRole("button", {
      name: /сталось|happened/i,
    });

    await didntHappenBtn.click();
    await happenedBtn.click();

    await expect(happenedBtn).toHaveClass(/indigo/);
  });

  test("generate button is not visible when all events are happened", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: /згенерувати сценарій|generate scenario/i })
    ).not.toBeVisible();
  });

  test("generate button appears when at least one event is didn't happen", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-xl.border").first();
    const didntHappenBtn = firstCard.getByRole("button", {
      name: /не сталось|didn't happen/i,
    });

    await didntHappenBtn.click();

    await expect(
      page.getByRole("button", { name: /згенерувати сценарій|generate scenario/i })
    ).toBeVisible();
  });

  test("generate button disappears when all toggled back to happened", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-xl.border").first();
    const didntHappenBtn = firstCard.getByRole("button", {
      name: /не сталось|didn't happen/i,
    });
    const happenedBtn = firstCard.getByRole("button", {
      name: /сталось|happened/i,
    });

    await didntHappenBtn.click();
    await expect(
      page.getByRole("button", { name: /згенерувати сценарій|generate scenario/i })
    ).toBeVisible();

    await happenedBtn.click();
    await expect(
      page.getByRole("button", { name: /згенерувати сценарій|generate scenario/i })
    ).not.toBeVisible();
  });

  test("generate button click navigates to scenario with correct query params", async ({
    page,
  }) => {
    const firstCard = page.locator(".rounded-xl.border").first();
    const didntHappenBtn = firstCard.getByRole("button", {
      name: /не сталось|didn't happen/i,
    });

    await didntHappenBtn.click();

    const generateBtn = page.getByRole("button", {
      name: /згенерувати сценарій|generate scenario/i,
    });
    await generateBtn.click();

    await page.waitForURL(/\/scenario/);
    const url = new URL(page.url());
    expect(url.searchParams.get("year")).toBe("1969");
    expect(url.searchParams.get("lang")).toBeTruthy();
    expect(url.searchParams.get("events")).toBeTruthy();
  });

  test("impact badges have correct color classes (high=red, medium=yellow, low=green)", async ({
    page,
  }) => {
    const highBadges = page.getByText("high", { exact: true });
    const mediumBadges = page.getByText("medium", { exact: true });
    const lowBadges = page.getByText("low", { exact: true });

    await expect(highBadges.first()).toHaveClass(/red/);
    await expect(mediumBadges.first()).toHaveClass(/yellow/);
    await expect(lowBadges.first()).toHaveClass(/green/);
  });
});
