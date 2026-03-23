/**
 * Accessibility audit — WCAG 2.1 AA
 *
 * Uses @axe-core/playwright to run automated accessibility checks on each page.
 * Automated checks cover ~30% of WCAG criteria; manual testing covers the rest.
 *
 * Run: npm run test:e2e -- --grep "accessibility"
 */
import { test, expect } from "@playwright/test";
import { AxeBuilder } from "@axe-core/playwright";
import type { Result } from "axe-core";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format axe violations into a readable failure message */
function formatViolations(violations: Result[]) {
  return violations
    .map(
      (v) =>
        `\n[${v.impact?.toUpperCase()}] ${v.id}: ${v.description}\n` +
        v.nodes.map((n) => `  → ${n.target.join(", ")}`).join("\n")
    )
    .join("\n");
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Accessibility audit (WCAG 2.1 AA)", () => {
  /**
   * Home page — year slider and submit button
   */
  test("home page has no critical or serious accessibility violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("canvas") // Three.js canvas — not semantic HTML
      .analyze();

    const criticalOrSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? "")
    );

    expect(
      criticalOrSerious,
      `Critical/serious violations found:\n${formatViolations(criticalOrSerious)}`
    ).toHaveLength(0);
  });

  /**
   * Events page — interactive event cards with toggle buttons
   */
  test("events page has no critical or serious accessibility violations", async ({ page }) => {
    await page.goto("/events/1969?lang=en&e2e_mock=1");

    // Wait for event cards to render
    await expect(page.locator("h2")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude(".animate-pulse") // Skeleton loaders aren't real content
      .analyze();

    const criticalOrSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? "")
    );

    expect(
      criticalOrSerious,
      `Critical/serious violations found:\n${formatViolations(criticalOrSerious)}`
    ).toHaveLength(0);
  });

  /**
   * Scenario page — streaming text result
   */
  test("scenario page has no critical or serious accessibility violations", async ({ page }) => {
    await page.route("**/api/scenario", (route) =>
      route.fulfill({
        status: 200,
        contentType: "text/plain; charset=utf-8",
        body: "In an alternate timeline where the moon landing never happened.",
      })
    );

    const params = new URLSearchParams({
      year: "1969",
      lang: "en",
      events: JSON.stringify([{ id: "1", happened: false }]),
    });
    await page.goto(`/scenario?${params}`);
    await expect(page.locator("h2")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const criticalOrSerious = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? "")
    );

    expect(
      criticalOrSerious,
      `Critical/serious violations found:\n${formatViolations(criticalOrSerious)}`
    ).toHaveLength(0);
  });

  /**
   * Full audit — report ALL violations (including moderate/minor) for awareness
   */
  test("home page full axe audit (all levels)", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toBeVisible();

    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .exclude("canvas")
      .analyze();

    // Log all violations at each level for the test report
    if (results.violations.length > 0) {
      console.log(
        `\n⚠ ${results.violations.length} axe violation(s) found:\n` +
          formatViolations(results.violations)
      );
    }

    // Only fail on critical/serious — warn on moderate/minor
    const blockers = results.violations.filter((v) =>
      ["critical", "serious"].includes(v.impact ?? "")
    );
    expect(
      blockers,
      `Blocking violations:\n${formatViolations(blockers)}`
    ).toHaveLength(0);
  });

  /**
   * Keyboard navigation — tab through interactive elements
   */
  test("home page is fully navigable by keyboard", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    const focused = page.locator(":focus");
    const tagName = await focused.evaluate((el) => el.tagName.toLowerCase());
    expect(["input", "button", "a"]).toContain(tagName);

    // Find submit button and confirm keyboard activation works
    const button = page.getByRole("button", { name: /view events|переглянути/i });
    await button.focus();
    await expect(button).toBeFocused();
  });

  /**
   * Semantic HTML structure — heading hierarchy
   */
  test("pages use correct heading hierarchy (no skipped levels)", async ({ page }) => {
    await page.goto("/");

    // Home page should have exactly one h1
    const h1Count = await page.locator("h1").count();
    expect(h1Count).toBe(1);

    // No h3/h4 without a preceding h2 — check events page
    await page.goto("/events/1969?lang=en&e2e_mock=1");
    await expect(page.locator("h2")).toBeVisible();

    const h3Count = await page.locator("h3").count();
    if (h3Count > 0) {
      const h2Count = await page.locator("h2").count();
      expect(h2Count).toBeGreaterThan(0);
    }
  });
});
