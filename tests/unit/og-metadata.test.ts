import { describe, it, expect } from "vitest";
import {
  OG_DEFAULT_IMAGE,
  safeOgImage,
  safeTitleFragment,
} from "@/lib/og";

/**
 * Regression suite for the OG link-preview phishing vector.
 *
 * /scenario?imageUrl=... previously flowed straight into openGraph.images and
 * twitter.images, so an attacker could produce a Slack/Twitter/Discord preview
 * showing arbitrary imagery and an arbitrary headline under our own domain.
 */
describe("safeOgImage", () => {
  it("falls back to the default when no URL is supplied", () => {
    expect(safeOgImage(undefined)).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage(null)).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("")).toBe(OG_DEFAULT_IMAGE);
  });

  it("accepts the fal.ai hosts we actually generate images on", () => {
    expect(safeOgImage("https://fal.media/files/abc.png")).toBe(
      "https://fal.media/files/abc.png"
    );
    expect(safeOgImage("https://v3.fal.media/files/abc.png")).toBe(
      "https://v3.fal.media/files/abc.png"
    );
    expect(safeOgImage("https://storage.googleapis.com/x/y.jpg")).toBe(
      "https://storage.googleapis.com/x/y.jpg"
    );
  });

  it("rejects arbitrary attacker-controlled hosts", () => {
    expect(safeOgImage("https://attacker.example/nsfw.png")).toBe(
      OG_DEFAULT_IMAGE
    );
  });

  it("rejects suffix-confusion hosts that merely end with the brand", () => {
    // "evil-fal.media" must NOT match the "fal.media" entry, and a subdomain
    // prefix must not be enough either.
    expect(safeOgImage("https://evilfal.media/x.png")).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("https://fal.media.attacker.example/x.png")).toBe(
      OG_DEFAULT_IMAGE
    );
  });

  it("rejects non-https schemes", () => {
    expect(safeOgImage("http://fal.media/x.png")).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("javascript:alert(1)")).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("data:image/png;base64,AAAA")).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("file:///etc/passwd")).toBe(OG_DEFAULT_IMAGE);
  });

  it("rejects malformed URLs and protocol-relative paths", () => {
    expect(safeOgImage("not a url")).toBe(OG_DEFAULT_IMAGE);
    expect(safeOgImage("//attacker.example/x.png")).toBe(OG_DEFAULT_IMAGE);
  });
});

describe("safeTitleFragment", () => {
  it("returns null for empty input", () => {
    expect(safeTitleFragment(undefined)).toBeNull();
    expect(safeTitleFragment("")).toBeNull();
    expect(safeTitleFragment("   ")).toBeNull();
  });

  it("caps length so the <title> cannot be stuffed", () => {
    const out = safeTitleFragment("x".repeat(5000));
    expect(out).toHaveLength(120);
  });

  it("flattens newlines and tabs into single spaces", () => {
    expect(safeTitleFragment("Moon\n\nLanding\tTitle")).toBe(
      "Moon Landing Title"
    );
  });

  it("preserves ordinary titles untouched", () => {
    expect(safeTitleFragment("Apollo 11 Moon Landing")).toBe(
      "Apollo 11 Moon Landing"
    );
  });
});
