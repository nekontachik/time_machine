/**
 * PWA manifest validation tests.
 *
 * Verifies that public/manifest.json meets the minimum requirements for
 * a valid installable Progressive Web App:
 * - Required fields per W3C Web App Manifest spec
 * - Icon sizes required for iOS, Android, and Chrome install prompts
 * - A maskable icon (needed for adaptive icons on Android)
 * - Valid color formats
 * - Shortcut sanity checks
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Load manifest
// ---------------------------------------------------------------------------

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

interface ManifestShortcut {
  name: string;
  short_name?: string;
  description?: string;
  url: string;
}

interface WebAppManifest {
  name?: string;
  short_name?: string;
  description?: string;
  start_url?: string;
  display?: string;
  background_color?: string;
  theme_color?: string;
  icons?: ManifestIcon[];
  shortcuts?: ManifestShortcut[];
  lang?: string;
  [key: string]: unknown;
}

const manifestPath = resolve(__dirname, "../../public/manifest.json");
const manifest: WebAppManifest = JSON.parse(readFileSync(manifestPath, "utf-8"));

// ---------------------------------------------------------------------------
// Required fields
// ---------------------------------------------------------------------------

describe("PWA manifest — required fields", () => {
  it("has a non-empty 'name'", () => {
    expect(manifest.name).toBeTruthy();
    expect(manifest.name!.length).toBeGreaterThan(0);
  });

  it("has a non-empty 'short_name' (≤ 12 chars for home screen)", () => {
    expect(manifest.short_name).toBeTruthy();
    // Chrome truncates short_name beyond 12 chars on some launchers
    expect(manifest.short_name!.length).toBeLessThanOrEqual(12);
  });

  it("has a 'start_url'", () => {
    expect(manifest.start_url).toBeTruthy();
  });

  it("has a valid 'display' mode", () => {
    const validModes = ["fullscreen", "standalone", "minimal-ui", "browser"];
    expect(validModes).toContain(manifest.display);
  });

  it("has a 'description'", () => {
    expect(manifest.description).toBeTruthy();
    expect(manifest.description!.length).toBeGreaterThan(10);
  });
});

// ---------------------------------------------------------------------------
// Color validation
// ---------------------------------------------------------------------------

describe("PWA manifest — colors", () => {
  const hexColor = /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/;

  it("'background_color' is a valid hex color", () => {
    expect(manifest.background_color).toMatch(hexColor);
  });

  it("'theme_color' is a valid hex color", () => {
    expect(manifest.theme_color).toMatch(hexColor);
  });
});

// ---------------------------------------------------------------------------
// Icon requirements
// ---------------------------------------------------------------------------

describe("PWA manifest — icons", () => {
  it("has at least one icon", () => {
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons!.length).toBeGreaterThan(0);
  });

  it("has a 192×192 icon (required for Chrome install prompt)", () => {
    const has192 = manifest.icons!.some((icon) => icon.sizes === "192x192");
    expect(has192, "Missing 192x192 icon required by Chrome").toBe(true);
  });

  it("has a 512×512 icon (required for splash screen)", () => {
    const has512 = manifest.icons!.some((icon) => icon.sizes === "512x512");
    expect(has512, "Missing 512x512 icon required for splash screen").toBe(true);
  });

  it("has at least one maskable icon (Android adaptive icons)", () => {
    const hasMaskable = manifest.icons!.some((icon) =>
      icon.purpose?.includes("maskable")
    );
    expect(hasMaskable, "No maskable icon — Android adaptive icons will not work").toBe(true);
  });

  it("all icons have required fields: src, sizes, type", () => {
    for (const icon of manifest.icons!) {
      expect(icon.src, `Icon missing 'src'`).toBeTruthy();
      expect(icon.sizes, `Icon ${icon.src} missing 'sizes'`).toBeTruthy();
      expect(icon.type, `Icon ${icon.src} missing 'type'`).toBeTruthy();
    }
  });

  it("all icon types are valid image MIME types", () => {
    const validTypes = ["image/png", "image/jpeg", "image/svg+xml", "image/webp"];
    for (const icon of manifest.icons!) {
      expect(
        validTypes,
        `Icon ${icon.src} has invalid type: ${icon.type}`
      ).toContain(icon.type);
    }
  });

  it("all icon src paths start with '/'", () => {
    for (const icon of manifest.icons!) {
      expect(icon.src, `Icon src '${icon.src}' should start with '/'`).toMatch(/^\//);
    }
  });
});

// ---------------------------------------------------------------------------
// Shortcuts validation
// ---------------------------------------------------------------------------

describe("PWA manifest — shortcuts", () => {
  it("shortcuts is an array when present", () => {
    if (manifest.shortcuts !== undefined) {
      expect(Array.isArray(manifest.shortcuts)).toBe(true);
    }
  });

  it("each shortcut has name and url", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(shortcut.name, "Shortcut missing 'name'").toBeTruthy();
      expect(shortcut.url, `Shortcut '${shortcut.name}' missing 'url'`).toBeTruthy();
    }
  });

  it("shortcut names are ≤ 25 chars", () => {
    for (const shortcut of manifest.shortcuts ?? []) {
      expect(
        shortcut.name.length,
        `Shortcut name '${shortcut.name}' exceeds 25 chars`
      ).toBeLessThanOrEqual(25);
    }
  });
});
