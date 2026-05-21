import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression test for C1 (SSRF via wildcard image hosts).
 *
 * Static check against next.config.mjs source — fails if anyone re-adds
 * `hostname: "**"` or `hostname: "*"` to the image remotePatterns.
 *
 * Doesn't import the config (it's ESM with side effects) — string-level
 * check is enough for this property.
 */
describe("next.config.mjs — image remotePatterns", () => {
  const cfg = fs.readFileSync(
    path.join(__dirname, "..", "..", "next.config.mjs"),
    "utf-8"
  );

  it("does not allow wildcard '**' hostnames", () => {
    // Allow comments mentioning **, but not actual config entries.
    const wildcardEntries = cfg.match(/hostname:\s*["']\*\*["']/g);
    expect(wildcardEntries).toBeNull();
  });

  it("does not allow bare '*' hostnames", () => {
    const bareWildcard = cfg.match(/hostname:\s*["']\*["']/g);
    expect(bareWildcard).toBeNull();
  });

  it("explicitly lists fal.media as an allowed host", () => {
    expect(cfg).toMatch(/hostname:\s*["']fal\.media["']/);
  });
});
