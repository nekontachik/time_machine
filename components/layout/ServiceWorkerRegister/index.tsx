"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Service workers are only useful in production.
    // In development they interfere with webpack HMR: the SW caches
    // /_next/static/ chunks, so when Next.js rebuilds a module the HMR
    // client receives a stale bundle, can't apply the hot patch, and falls
    // back to a full page reload — which wipes all in-progress AI generation.
    if (process.env.NODE_ENV !== "production") {
      // Unregister any previously registered SW so it stops intercepting requests
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((r) => r.unregister());
      });
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW registration failure is non-fatal
    });
  }, []);

  return null;
}
