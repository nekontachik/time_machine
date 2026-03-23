/**
 * i18n completeness tests.
 *
 * Ensures every translation key present in one locale exists in all other
 * locales — no silent missing translations that would render as raw key names.
 *
 * Also validates value types and checks for any empty strings that should
 * be non-empty (except intentionally empty values like `scenario.yearSuffix`
 * for English, where the suffix is an empty string by design).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type Messages = Record<string, Record<string, string>>;

function loadMessages(locale: string): Messages {
  const filePath = resolve(__dirname, `../../messages/${locale}.json`);
  return JSON.parse(readFileSync(filePath, "utf-8")) as Messages;
}

/** Recursively collect all dot-notation key paths in an object */
function collectKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) =>
    collectKeys(v, prefix ? `${prefix}.${k}` : k)
  );
}

const LOCALES = ["en", "uk"];
const allMessages: Record<string, Messages> = {};
for (const locale of LOCALES) {
  allMessages[locale] = loadMessages(locale);
}

// Keys intentionally empty in a specific locale
const INTENTIONALLY_EMPTY: string[] = [
  "en.scenario.yearSuffix", // English has no year suffix
  "en.events.year",         // English has no "рік" suffix
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("i18n key completeness", () => {
  for (const sourceLocale of LOCALES) {
    const sourceKeys = collectKeys(allMessages[sourceLocale]);

    for (const targetLocale of LOCALES) {
      if (sourceLocale === targetLocale) continue;
      const targetKeys = new Set(collectKeys(allMessages[targetLocale]));

      it(`all keys from '${sourceLocale}' exist in '${targetLocale}'`, () => {
        const missing = sourceKeys.filter((k) => !targetKeys.has(k));
        expect(missing, `Missing keys in ${targetLocale}: ${missing.join(", ")}`).toHaveLength(0);
      });
    }
  }
});

describe("i18n value quality", () => {
  for (const locale of LOCALES) {
    const keys = collectKeys(allMessages[locale]);

    it(`'${locale}' has no undefined or null values`, () => {
      const badKeys: string[] = [];
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = allMessages[locale];
        for (const part of parts) val = (val as Record<string, unknown>)[part];
        if (val === undefined || val === null) badKeys.push(key);
      }
      expect(badKeys, `Null/undefined values in ${locale}: ${badKeys.join(", ")}`).toHaveLength(0);
    });

    it(`'${locale}' has no unexpectedly empty strings`, () => {
      const badKeys: string[] = [];
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = allMessages[locale];
        for (const part of parts) val = (val as Record<string, unknown>)[part];

        if (val === "" && !INTENTIONALLY_EMPTY.includes(`${locale}.${key}`)) {
          badKeys.push(key);
        }
      }
      expect(
        badKeys,
        `Unexpected empty strings in ${locale}: ${badKeys.join(", ")}`
      ).toHaveLength(0);
    });

    it(`'${locale}' has no keys with whitespace-only values`, () => {
      const badKeys: string[] = [];
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = allMessages[locale];
        for (const part of parts) val = (val as Record<string, unknown>)[part];
        if (typeof val === "string" && val.trim() === "" && val !== "") {
          badKeys.push(key);
        }
      }
      expect(badKeys, `Whitespace-only values in ${locale}: ${badKeys.join(", ")}`).toHaveLength(0);
    });
  }
});

describe("i18n namespace structure", () => {
  const expectedNamespaces = ["home", "events", "scenario", "shareCard", "premium", "installPrompt"];

  for (const locale of LOCALES) {
    it(`'${locale}' contains all expected namespaces`, () => {
      const namespaces = Object.keys(allMessages[locale]);
      for (const ns of expectedNamespaces) {
        expect(namespaces, `Namespace '${ns}' missing from ${locale}`).toContain(ns);
      }
    });
  }
});
