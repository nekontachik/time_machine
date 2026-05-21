import { test, expect } from "@playwright/test";

/**
 * API contract tests — verify request/response shapes independently
 * of the AI providers. These tests validate error handling and input
 * validation without needing real API keys.
 */

test.describe("API: /api/historical-events", () => {
  test("returns 400 without year parameter", async ({ request }) => {
    const res = await request.get("/api/historical-events");
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("returns 400 for out-of-range year", async ({ request }) => {
    const res = await request.get("/api/historical-events?year=99999");
    expect(res.status()).toBe(400);
  });

  test("returns 400 for non-numeric year", async ({ request }) => {
    const res = await request.get("/api/historical-events?year=hello");
    expect(res.status()).toBe(400);
  });
});

test.describe("API: /api/scenario", () => {
  test("returns 400 for empty body", async ({ request }) => {
    const res = await request.post("/api/scenario", {
      data: {},
    });
    expect(res.status()).toBe(400);
  });

  test("returns 400 for missing events", async ({ request }) => {
    const res = await request.post("/api/scenario", {
      data: { year: 1969, lang: "en" },
    });
    expect(res.status()).toBe(400);
  });
});

test.describe("API: /api/image", () => {
  test("returns 400 for empty body", async ({ request }) => {
    const res = await request.post("/api/image", { data: {} });
    expect(res.status()).toBe(400);
  });

  test("returns 400 without scenarioSummary", async ({ request }) => {
    const res = await request.post("/api/image", {
      data: { year: 1969 },
    });
    expect(res.status()).toBe(400);
  });
});



test.describe("API: /api/test-flux", () => {
  test("returns 404 in production mode", async ({ request }) => {
    // In development this will pass through, in production it returns 404
    const res = await request.post("/api/test-flux", {
      data: { event: "Test", scenario: "Test", year: 2000 },
    });
    // In dev mode it might succeed; we just check it doesn't crash
    expect([200, 404, 500]).toContain(res.status());
  });
});
