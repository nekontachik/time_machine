/**
 * Performance budget — E2E tests
 *
 * Asserts that key pages meet Web Performance budgets:
 *   • LCP (Largest Contentful Paint) < 2 500 ms
 *   • FCP (First Contentful Paint)   < 1 800 ms
 *   • TTI (Time to Interactive / domInteractive) < 3 500 ms
 *   • Total page load time < 5 000 ms
 *
 * Strategy:
 *   1. Use the Performance Navigation Timing API (via `page.evaluate`) for
 *      FCP, TTI and load times — widely available and reliable in headless Chrome.
 *   2. Use PerformanceObserver to capture LCP entries; fall back to
 *      `page.metrics()` FirstMeaningfulPaint when LCP is unavailable
 *      (e.g. headless environments where the tab is not foregrounded).
 *   3. Use CDP Performance.getMetrics as a secondary source for JS heap
 *      size and task duration budgets.
 *
 * Run: npm run test:e2e -- --grep "Performance budget"
 */
import { test, expect } from "@playwright/test";

// ---------------------------------------------------------------------------
// Thresholds (ms)
// ---------------------------------------------------------------------------

const BUDGET = {
  LCP_MS: 2_500,
  FCP_MS: 1_800,
  TTI_MS: 3_500,
  LOAD_MS: 5_000,
  /** JS heap budget — catch memory regressions (bytes) */
  JS_HEAP_BYTES: 50 * 1024 * 1024, // 50 MB
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NavTiming {
  fcp: number;       // First Contentful Paint (ms from navigationStart)
  tti: number;       // domInteractive (ms from navigationStart)
  domComplete: number;
  loadEventEnd: number;
}

/** Collect Navigation Timing + FCP via page.evaluate */
async function collectNavTiming(
  page: import("@playwright/test").Page
): Promise<NavTiming> {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType(
      "navigation"
    )[0] as PerformanceNavigationTiming;

    // FCP from PerformancePaintTiming entries
    const fcpEntry = performance
      .getEntriesByType("paint")
      .find((e) => e.name === "first-contentful-paint");

    return {
      fcp: fcpEntry?.startTime ?? 0,
      tti: nav?.domInteractive ?? 0,
      domComplete: nav?.domComplete ?? 0,
      loadEventEnd: nav?.loadEventEnd ?? 0,
    };
  });
}

/**
 * Attempt to read LCP from buffered PerformanceObserver entries.
 * Returns 0 when LCP is not available (headless, no user interaction).
 */
async function collectLcp(page: import("@playwright/test").Page): Promise<number> {
  return page.evaluate(() => {
    return new Promise<number>((resolve) => {
      let latestLcp = 0;

      try {
        const observer = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          if (entries.length > 0) {
            latestLcp = entries[entries.length - 1].startTime;
          }
        });
        observer.observe({ type: "largest-contentful-paint", buffered: true });
      } catch {
        // LCP PerformanceObserver not available in this environment
      }

      // Give buffered entries a tick to arrive, then resolve
      setTimeout(() => resolve(latestLcp), 150);
    });
  });
}

// ---------------------------------------------------------------------------
// Tests — only run on Chromium (metrics require CDP / V8)
// ---------------------------------------------------------------------------

test.describe("Performance budget", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Performance metrics only available in Chromium"
  );

  // -------------------------------------------------------------------------
  // Home page
  // -------------------------------------------------------------------------

  test("home page meets LCP < 2 500 ms budget", async ({ page }) => {
    // Enable CDP Performance domain for JS-heap metrics
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Performance.enable");

    await page.goto("/", { waitUntil: "networkidle" });

    // Allow LCP observer to settle after load
    await page.waitForTimeout(200);

    const [timing, lcpMs, cdpMetrics] = await Promise.all([
      collectNavTiming(page),
      collectLcp(page),
      cdp.send("Performance.getMetrics"),
    ]);

    // Map CDP metrics by name for easy lookup
    const cdpMap = Object.fromEntries(
      cdpMetrics.metrics.map(({ name, value }) => [name, value])
    );

    // -- LCP / FMP assertion --------------------------------------------------
    if (lcpMs > 0) {
      expect(
        lcpMs,
        `LCP ${lcpMs.toFixed(0)} ms exceeds ${BUDGET.LCP_MS} ms budget`
      ).toBeLessThan(BUDGET.LCP_MS);
    } else {
      // Headless LCP unavailable — use FirstMeaningfulPaint as proxy
      const fmpMs =
        ((cdpMap["FirstMeaningfulPaint"] ?? 0) -
          (cdpMap["NavigationStart"] ?? 0)) *
        1000;

      if (fmpMs > 0) {
        expect(
          fmpMs,
          `FirstMeaningfulPaint ${fmpMs.toFixed(0)} ms exceeds ${BUDGET.LCP_MS} ms LCP proxy budget`
        ).toBeLessThan(BUDGET.LCP_MS);
      }
    }

    // -- FCP assertion --------------------------------------------------------
    if (timing.fcp > 0) {
      expect(
        timing.fcp,
        `FCP ${timing.fcp.toFixed(0)} ms exceeds ${BUDGET.FCP_MS} ms budget`
      ).toBeLessThan(BUDGET.FCP_MS);
    }

    // -- TTI / domInteractive assertion ----------------------------------------
    if (timing.tti > 0) {
      expect(
        timing.tti,
        `domInteractive ${timing.tti.toFixed(0)} ms exceeds ${BUDGET.TTI_MS} ms budget`
      ).toBeLessThan(BUDGET.TTI_MS);
    }

    // -- Total load time assertion --------------------------------------------
    if (timing.loadEventEnd > 0) {
      expect(
        timing.loadEventEnd,
        `loadEventEnd ${timing.loadEventEnd.toFixed(0)} ms exceeds ${BUDGET.LOAD_MS} ms budget`
      ).toBeLessThan(BUDGET.LOAD_MS);
    }

    // -- JS heap assertion (memory regression guard) -------------------------
    const heapBytes = cdpMap["JSHeapUsedSize"] ?? 0;
    if (heapBytes > 0) {
      expect(
        heapBytes,
        `JS heap ${(heapBytes / 1024 / 1024).toFixed(1)} MB exceeds ${
          BUDGET.JS_HEAP_BYTES / 1024 / 1024
        } MB budget`
      ).toBeLessThan(BUDGET.JS_HEAP_BYTES);
    }

    // Log metrics for visibility in CI reports
    console.log(
      `[perf/home] LCP=${lcpMs.toFixed(0)}ms FCP=${timing.fcp.toFixed(0)}ms TTI=${timing.tti.toFixed(0)}ms load=${timing.loadEventEnd.toFixed(0)}ms heap=${(heapBytes / 1024 / 1024).toFixed(1)}MB`
    );
  });

  // -------------------------------------------------------------------------
  // Events page
  // -------------------------------------------------------------------------

  test("events page meets performance budget", async ({ page }) => {
    await page.goto("/events/1969?lang=en&e2e_mock=1", {
      waitUntil: "networkidle",
    });

    // Wait for event cards to appear (dynamic content)
    await expect(page.locator("h2").first()).toBeVisible({ timeout: 5000 });

    await page.waitForTimeout(200);

    const timing = await collectNavTiming(page);

    if (timing.tti > 0) {
      expect(
        timing.tti,
        `Events page domInteractive ${timing.tti.toFixed(0)} ms exceeds ${BUDGET.TTI_MS} ms`
      ).toBeLessThan(BUDGET.TTI_MS);
    }

    if (timing.loadEventEnd > 0) {
      expect(
        timing.loadEventEnd,
        `Events page load ${timing.loadEventEnd.toFixed(0)} ms exceeds ${BUDGET.LOAD_MS} ms`
      ).toBeLessThan(BUDGET.LOAD_MS);
    }

    console.log(
      `[perf/events] TTI=${timing.tti.toFixed(0)}ms load=${timing.loadEventEnd.toFixed(0)}ms`
    );
  });

  // -------------------------------------------------------------------------
  // Resource count — prevent accidental bundle bloat
  // -------------------------------------------------------------------------

  test("home page JS bundle count does not exceed threshold", async ({ page }) => {
    const jsRequests: string[] = [];

    page.on("response", (resp) => {
      const url = resp.url();
      if (url.includes("/_next/static/chunks") && url.endsWith(".js")) {
        jsRequests.push(url);
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });

    // Log for awareness; warn rather than hard-fail on bundle count
    console.log(`[perf/home] Loaded ${jsRequests.length} JS chunk(s)`);

    // Hard budget: should not load more than 30 individual JS chunks
    expect(
      jsRequests.length,
      `Too many JS chunks (${jsRequests.length}); possible bundle regression`
    ).toBeLessThan(30);
  });

  // -------------------------------------------------------------------------
  // Long Tasks — detect main-thread blocking > 50 ms
  // -------------------------------------------------------------------------

  test("home page has no excessive long tasks on load", async ({ page }) => {
    // Inject a PerformanceObserver before navigation to capture long tasks
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__longTasks = [];
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            (window as unknown as Record<string, number[]>).__longTasks.push(
              entry.duration
            );
          }
        });
        observer.observe({ type: "longtask", buffered: true });
      } catch {
        // PerformanceObserver longtask not available
      }
    });

    await page.goto("/", { waitUntil: "networkidle" });
    await page.waitForTimeout(200);

    const longTasks = await page.evaluate(
      () => (window as unknown as Record<string, number[]>).__longTasks ?? []
    );

    // Sum total long task time (anything > 50 ms blocks the main thread)
    const totalBlockingTime = longTasks
      .filter((d) => d > 50)
      .reduce((sum, d) => sum + (d - 50), 0);

    console.log(
      `[perf/home] Long tasks: ${longTasks.length}, TBT=${totalBlockingTime.toFixed(0)}ms`
    );

    // Soft budget: warn if Total Blocking Time exceeds 300 ms
    expect(
      totalBlockingTime,
      `Total Blocking Time ${totalBlockingTime.toFixed(0)} ms exceeds 300 ms budget`
    ).toBeLessThan(300);
  });
});
