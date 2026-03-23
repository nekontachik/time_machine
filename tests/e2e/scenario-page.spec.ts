import { test, expect } from "@playwright/test";
import { mockScenarioAPI, mockScenarioAPIError, mockImageAPI } from "./helpers/mock-api";

const VALID_PARAMS =
  "year=1969&lang=ua&events=" +
  encodeURIComponent(
    JSON.stringify([
      { id: "1", happened: false },
      { id: "2", happened: true },
      { id: "3", happened: true },
      { id: "4", happened: true },
      { id: "5", happened: true },
    ])
  );

test.describe("Scenario page", () => {
  test("page without query params shows placeholder text", async ({ page }) => {
    await page.goto("/scenario");
    await expect(
      page.getByText(/оберіть події|select events and click/i)
    ).toBeVisible();
  });

  test("page with valid params shows loading skeleton initially", async ({
    page,
  }) => {
    // Delay response so loading state is visible
    await page.route("**/api/scenario", async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "Delayed response",
      });
    });
    await page.goto(`/scenario?${VALID_PARAMS}`);

    await expect(
      page.getByText(/генерую історію|generating history/i)
    ).toBeVisible({ timeout: 2000 });
  });

  test("mocked scenario API returns text - verify text appears", async ({
    page,
  }) => {
    const mockText =
      "In an alternate timeline where the moon landing never happened.";
    await mockScenarioAPI(page, mockText);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    await expect(page.getByText(mockText)).toBeVisible({ timeout: 5000 });
  });

  test("mocked scenario API error shows error state with red box", async ({
    page,
  }) => {
    await mockScenarioAPIError(page, 500);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    await expect(
      page.getByText(/помилка|error/i).first()
    ).toBeVisible({ timeout: 5000 });
    await expect(
      page.locator("[class*='border-red'][class*='bg-red']")
    ).toBeVisible();
  });

  test("back link navigates to home", async ({ page }) => {
    await mockScenarioAPI(page, "Quick.");
    await page.goto(`/scenario?${VALID_PARAMS}`);

    const backLink = page.getByRole("link", {
      name: /новий сценарій|new scenario/i,
    });
    await backLink.click();

    await page.waitForURL("/");
    expect(page.url()).not.toContain("/scenario");
  });

  test("year is displayed in h2 heading", async ({ page }) => {
    await mockScenarioAPI(page, "Text.");
    await page.goto(`/scenario?${VALID_PARAMS}`);

    const heading = page.locator("h2");
    await expect(heading).toContainText("1969");
  });

  test("after streaming completes, image request is made", async ({ page }) => {
    await mockScenarioAPI(page, "Scenario text for image.");
    await mockImageAPI(page, "https://example.com/scenario.jpg");
    await page.goto(`/scenario?${VALID_PARAMS}`);

    await expect(page.getByText("Scenario text for image.")).toBeVisible({
      timeout: 5000,
    });
    await expect(page.locator('img[src*="example.com"]')).toBeVisible({
      timeout: 5000,
    });
  });
});
