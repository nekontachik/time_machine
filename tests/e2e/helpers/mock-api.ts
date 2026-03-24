import type { Page, Request } from "@playwright/test";

const DEFAULT_SCENARIO_TEXT =
  "In an alternate timeline where the moon landing never happened, the space race took a dramatically different turn...";

/**
 * Smallest valid PNG (1×1 transparent pixel) as a data-URI.
 * Using a data-URI means the browser can actually load it in headless mode,
 * so img.naturalWidth > 0 and img.complete === true — unlike external URLs
 * that would 404 in the test environment.
 */
export const VALID_IMAGE_DATA_URI =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

// ── Scenario API mocks ────────────────────────────────────────────────────

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

/** Delay the scenario response so the skeleton loading state is visible. */
export async function mockScenarioAPIWithDelay(
  page: Page,
  text = DEFAULT_SCENARIO_TEXT,
  delayMs = 800
) {
  await page.route("**/api/scenario", async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: text,
    });
  });
}

// ── Image API mocks ───────────────────────────────────────────────────────

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

/** Mock /api/image with an HTTP error status. */
export async function mockImageAPIError(page: Page, status = 500) {
  await page.route("**/api/image", (route) =>
    route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify({ error: "Image generation failed" }),
    })
  );
}

/**
 * Mock /api/image with a placeholder URL (simulates fal.ai timeout/error
 * handled silently inside generateScenarioImage).
 * year param mirrors the real getPlaceholderUrl() logic in lib/ai/image.ts.
 */
export async function mockImageAPIWithPlaceholder(page: Page, year: number) {
  let placeholder: string;
  if (year < 500) placeholder = "/placeholder-ancient.jpg";
  else if (year <= 1900) placeholder = "/placeholder-modern.jpg";
  else placeholder = "/placeholder-future.jpg";

  await page.route("**/api/image", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageUrl: placeholder }),
    })
  );
}

/**
 * Delay the image API response so we can assert the "text visible,
 * image not yet loaded" state.
 */
export async function mockImageAPIWithDelay(
  page: Page,
  imageUrl = VALID_IMAGE_DATA_URI,
  delayMs = 1500
) {
  await page.route("**/api/image", async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ imageUrl }),
    });
  });
}

/**
 * Capture the JSON body of the first /api/image POST request.
 * Returns a Promise that resolves when the request is made.
 */
export function captureImageAPIRequest(page: Page): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    page.on("request", (req: Request) => {
      if (req.url().includes("/api/image") && req.method() === "POST") {
        try {
          resolve(JSON.parse(req.postData() ?? "{}") as Record<string, unknown>);
        } catch {
          resolve({});
        }
      }
    });
  });
}
