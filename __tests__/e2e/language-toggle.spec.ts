import { test, expect } from "@playwright/test";

test.describe("Language toggle", () => {
  test("with UA cookie - verify Ukrainian text on home page", async ({
    page,
    context,
  }) => {
    await context.addCookies([
      { name: "locale", value: "uk", domain: "localhost", path: "/" },
    ]);
    await page.goto("/");
    await expect(
      page.getByText(/обери рік|зміни історію|альтернативне майбутнє/i)
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /переглянути події/i })
    ).toBeVisible();
  });

  test("click EN - verify English text appears", async ({ page, context }) => {
    await context.addCookies([
      { name: "locale", value: "uk", domain: "localhost", path: "/" },
    ]);
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "EN", exact: true }).click();

    await expect(page.getByText(/pick a year|change history/i)).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByRole("button", { name: /view events/i })
    ).toBeVisible();
  });

  test("click UA - verify Ukrainian text returns", async ({ page, context }) => {
    await context.addCookies([
      { name: "locale", value: "uk", domain: "localhost", path: "/" },
    ]);
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText(/pick a year/i)).toBeVisible({ timeout: 5000 });

    await page.locator("header").getByRole("button", { name: "UA", exact: true }).click();
    await expect(
      page.getByRole("button", { name: /переглянути події/i })
    ).toBeVisible({ timeout: 10000 });
  });

  test("language persists across navigation", async ({ page, context }) => {
    await context.addCookies([
      { name: "locale", value: "uk", domain: "localhost", path: "/" },
    ]);
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText(/pick a year/i)).toBeVisible({ timeout: 5000 });

    const submitBtn = page.getByRole("button", { name: /view events/i });
    await submitBtn.click();
    await page.waitForURL(/\/events\//);

    expect(page.url()).toContain("lang=en");
  });

  test("locale cookie is set on toggle", async ({ page, context }) => {
    await context.addCookies([
      { name: "locale", value: "uk", domain: "localhost", path: "/" },
    ]);
    await page.goto("/");
    await page.locator("header").getByRole("button", { name: "EN", exact: true }).click();
    await expect(page.getByText(/pick a year/i)).toBeVisible({ timeout: 5000 });

    const cookies = await context.cookies();
    const locale = cookies.find((c) => c.name === "locale")?.value;
    expect(locale).toBe("en");
  });
});
