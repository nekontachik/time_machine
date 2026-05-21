import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Cross-cutting policy test (C2).
 *
 * Every AI-cost-bearing route must call checkBucketLimit (or the legacy
 * checkRateLimit alias). If someone adds a new AI route and forgets the
 * rate-limit, this test catches it.
 *
 * SSR pages that trigger AI calls on cache-miss are also required to
 * import the rate-limit helper.
 */
const ROUTES_REQUIRING_RATE_LIMIT = [
  "app/api/scenario/route.ts",
  "app/api/historical-events/route.ts",
  "app/api/image/route.ts",
  "app/events/[year]/page.tsx",
];

describe("Rate-limit coverage", () => {
  it.each(ROUTES_REQUIRING_RATE_LIMIT)(
    "%s imports a rate-limit helper",
    (relPath) => {
      const src = fs.readFileSync(
        path.join(__dirname, "..", "..", relPath),
        "utf-8"
      );
      expect(src).toMatch(/checkBucketLimit|checkRateLimit/);
    }
  );

  it.each(ROUTES_REQUIRING_RATE_LIMIT)(
    "%s actually calls the rate-limit helper (not just imports it)",
    (relPath) => {
      const src = fs.readFileSync(
        path.join(__dirname, "..", "..", relPath),
        "utf-8"
      );
      expect(src).toMatch(/(?:checkBucketLimit|checkRateLimit)\s*\(/);
    }
  );
});
