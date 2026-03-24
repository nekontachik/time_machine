import { test, expect } from "@playwright/test";
import {
  mockScenarioAPI,
  mockScenarioAPIError,
  mockScenarioAPIWithDelay,
  mockImageAPI,
  mockImageAPIError,
  mockImageAPIWithPlaceholder,
  mockImageAPIWithDelay,
  captureImageAPIRequest,
  VALID_IMAGE_DATA_URI,
} from "./helpers/mock-api";

const VALID_PARAMS =
  "year=1969&lang=en&events=" +
  encodeURIComponent(
    JSON.stringify([
      { id: "1", happened: false },
      { id: "2", happened: true },
      { id: "3", happened: true },
      { id: "4", happened: true },
      { id: "5", happened: true },
    ])
  );

// ── Existing tests (unchanged) ────────────────────────────────────────────

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

// ── Image quality & reliability tests ────────────────────────────────────

test.describe("Scenario page — image loading", () => {

  // ── 1. Image actually loaded (not broken) ───────────────────────────────

  test("img is not broken — naturalWidth > 0 after load", async ({ page }) => {
    await mockScenarioAPI(page, "The world changed forever in 1969.");
    // Use a real loadable data-URI so the browser can decode the image
    await mockImageAPI(page, VALID_IMAGE_DATA_URI);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    const img = page.locator("img").first();
    await expect(img).toBeVisible({ timeout: 8000 });

    // Wait for the browser to finish loading the image
    await img.waitFor({ state: "visible" });

    const { complete, naturalWidth } = await page.evaluate(() => {
      const el = document.querySelector("img") as HTMLImageElement | null;
      return {
        complete: el?.complete ?? false,
        naturalWidth: el?.naturalWidth ?? 0,
      };
    });

    expect(complete, "img.complete should be true").toBe(true);
    expect(naturalWidth, "img.naturalWidth should be > 0 (not broken)").toBeGreaterThan(0);
  });

  // ── 2. Fallback: placeholder URL → img NOT rendered ─────────────────────

  test("img element is NOT shown when API returns a placeholder URL", async ({
    page,
  }) => {
    await mockScenarioAPI(page, "History diverged in 44 BC.");
    // Simulate fal.ai failing silently: API returns placeholder path
    await mockImageAPIWithPlaceholder(page, 1969);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    // Text must appear — streaming worked
    await expect(page.getByText("History diverged in 44 BC.")).toBeVisible({
      timeout: 6000,
    });

    // Allow image request to complete
    await page.waitForTimeout(500);

    // Component condition: imageUrl.startsWith("/placeholder") → no <img>
    const imgCount = await page.locator("img").count();
    expect(imgCount, "No <img> should be rendered for placeholder URLs").toBe(0);
  });

  test("img NOT shown for placeholder-ancient.jpg (year < 500)", async ({
    page,
  }) => {
    await mockScenarioAPI(page, "Rome was never founded.");
    await mockImageAPIWithPlaceholder(page, -753); // ancient era
    await page.goto(
      `year=-753&lang=en&events=${encodeURIComponent(
        JSON.stringify([{ id: "1", happened: false }])
      )}`
        ? `/scenario?year=-753&lang=en&events=${encodeURIComponent(
            JSON.stringify([{ id: "1", happened: false }])
          )}`
        : `/scenario?${VALID_PARAMS}`
    );

    await page.waitForTimeout(600);
    const imgCount = await page.locator("img").count();
    expect(imgCount).toBe(0);
  });

  // ── 3. Fallback: /api/image 500 → img NOT rendered, text still visible ──

  test("img NOT shown and page does not crash when /api/image returns 500", async ({
    page,
  }) => {
    const scenarioText = "The space race was cancelled.";
    await mockScenarioAPI(page, scenarioText);
    await mockImageAPIError(page, 500);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    // Text must still appear — image error is swallowed silently
    await expect(page.getByText(scenarioText)).toBeVisible({ timeout: 6000 });

    // No crash — no error box for image failures
    await expect(
      page.locator("[class*='border-red'][class*='bg-red']")
    ).not.toBeVisible();

    // No <img> rendered
    await page.waitForTimeout(400);
    const imgCount = await page.locator("img").count();
    expect(imgCount, "<img> should not appear on image API 500").toBe(0);
  });

  test("img NOT shown when /api/image returns 404", async ({ page }) => {
    await mockScenarioAPI(page, "Alternative 1969.");
    await mockImageAPIError(page, 404);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    await expect(page.getByText("Alternative 1969.")).toBeVisible({
      timeout: 6000,
    });
    await page.waitForTimeout(400);
    expect(await page.locator("img").count()).toBe(0);
  });

  // ── 4. Loading state: text visible while image is still loading ─────────

  test("scenario text is visible while image request is still in-flight", async ({
    page,
  }) => {
    const scenarioText = "Humanity chose a different path.";
    await mockScenarioAPI(page, scenarioText);
    // Delay image response by 2 s — long enough to assert mid-state
    await mockImageAPIWithDelay(page, VALID_IMAGE_DATA_URI, 2000);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    // Text should appear before image (streaming finishes first)
    await expect(page.getByText(scenarioText)).toBeVisible({ timeout: 6000 });

    // At this point image is still loading — no <img> yet
    const imgCountBeforeImage = await page.locator("img").count();
    expect(
      imgCountBeforeImage,
      "img should not yet be visible while image API is in-flight"
    ).toBe(0);

    // Eventually image arrives
    await expect(page.locator("img").first()).toBeVisible({ timeout: 5000 });
  });

  test("skeleton animate-pulse divs visible before first text chunk", async ({
    page,
  }) => {
    // Delay scenario to keep skeleton visible
    await mockScenarioAPIWithDelay(page, "Text arrives late.", 1200);
    await mockImageAPI(page, VALID_IMAGE_DATA_URI);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    // Skeleton: animate-pulse divs inside the loading container
    const skeleton = page.locator("[class*='animate-pulse']").first();
    await expect(skeleton).toBeVisible({ timeout: 3000 });

    // After text arrives, skeleton is replaced by actual content
    await expect(page.getByText("Text arrives late.")).toBeVisible({
      timeout: 5000,
    });
    await expect(skeleton).not.toBeVisible();
  });

  // ── 5. Prompt integration: /api/image receives correct payload ──────────

  test("/api/image request body contains streamed text as scenarioSummary", async ({
    page,
  }) => {
    const scenarioText =
      "In 1969 the mission was aborted. " + "x".repeat(300); // > 400 chars total to test slicing

    // Start capturing BEFORE navigation
    const imageRequestPromise = captureImageAPIRequest(page);
    await mockScenarioAPI(page, scenarioText);
    await mockImageAPI(page, VALID_IMAGE_DATA_URI);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    // Wait for image request to be made
    const imageBody = await imageRequestPromise;

    // scenarioSummary must be first 400 chars of the streamed text
    const expectedSummary = scenarioText.slice(0, 400);
    expect(imageBody.scenarioSummary).toBe(expectedSummary);
  });

  test("/api/image request body contains correct year from URL params", async ({
    page,
  }) => {
    const imageRequestPromise = captureImageAPIRequest(page);
    await mockScenarioAPI(page, "The Titanic never sank.");
    await mockImageAPI(page, VALID_IMAGE_DATA_URI);
    await page.goto(`/scenario?${VALID_PARAMS}`); // year=1969

    const imageBody = await imageRequestPromise;

    expect(imageBody.year).toBe(1969);
    expect(imageBody.style).toBe("cinematic");
  });

  test("/api/image scenarioSummary is truncated to 400 chars", async ({
    page,
  }) => {
    // 600-char scenario text — must be sliced to 400 in the request
    const longText = "A".repeat(600);
    const imageRequestPromise = captureImageAPIRequest(page);
    await mockScenarioAPI(page, longText);
    await mockImageAPI(page, VALID_IMAGE_DATA_URI);
    await page.goto(`/scenario?${VALID_PARAMS}`);

    const imageBody = await imageRequestPromise;

    expect(
      (imageBody.scenarioSummary as string).length,
      "scenarioSummary must be ≤ 400 chars"
    ).toBeLessThanOrEqual(400);
  });
});
