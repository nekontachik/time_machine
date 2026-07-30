import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

/**
 * Service worker source. Compiled to /sw.js at build time by @serwist/next
 * (see next.config.mjs).
 *
 * Replaces next-pwa, which has been unmaintained since 2022 and pulled a
 * vulnerable workbox-build → rollup-plugin-terser → serialize-javascript
 * chain into the dependency tree.
 */

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Take control immediately on new deploys instead of waiting for every tab
  // to close. Without these, returning visitors keep running the previously
  // cached build until they manually clear it.
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
