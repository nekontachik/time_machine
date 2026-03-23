import type { Page } from "@playwright/test";

const DEFAULT_SCENARIO_TEXT =
  "In an alternate timeline where the moon landing never happened, the space race took a dramatically different turn...";

export async function mockScenarioAPI(page: Page, text = DEFAULT_SCENARIO_TEXT) {
  await page.route("**/api/scenario", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: text,
    })
  );
}

export async function mockScenarioAPIError(page: Page, status = 500) {
  await page.route("**/api/scenario", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: "Internal server error" }),
    })
  );
}

export async function mockImageAPI(
  page: Page,
  imageUrl = "https://fal.ai/result/test.jpg"
) {
  await page.route("**/api/image", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageUrl }),
    })
  );
}
