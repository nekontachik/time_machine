import withPWA from "next-pwa";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Resolve NEXT_PUBLIC_APP_URL automatically on Vercel if not set explicitly.
  // VERCEL_URL is a built-in system env var (no https:// prefix).
  env: {
    NEXT_PUBLIC_APP_URL:
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : "http://localhost:3000"),
  },

  // Exclude heavy server-only packages from webpack bundling.
  // Next.js uses Node.js native require() for these instead, which avoids
  // webpack trying to parse complex/broken ESM exports (e.g. robot3 inside
  // @fal-ai/client) and prevents the "Cannot read properties of undefined
  // (reading 'call')" factory error in options.factory.
  experimental: {
    serverComponentsExternalPackages: [
      "@fal-ai/client",
      "ioredis",
      "openai",
    ],
  },
  images: {
    remotePatterns: [
      // fal.ai — Flux image generation
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Tavily — thumbnail images from web search results.
      // Limited to known Tavily-CDN + Wikipedia hosts to prevent SSRF via
      // /_next/image?url=<arbitrary-https>. If a new Tavily-CDN host appears
      // in production logs, add it explicitly here — never use a wildcard.
      { protocol: "https", hostname: "*.tavilyusercontent.com" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

const pwaConfig = withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  // Take control immediately on new deploys instead of waiting for all tabs to
  // close. Without these, returning visitors keep running the previously cached
  // build (old service worker stays in control) until they manually clear it.
  skipWaiting: true,
  clientsClaim: true,
  // next-pwa wrongly tries to precache App Router build manifests that 404 in
  // production, which makes the service worker install fail with
  // "bad-precaching-response". Exclude them from the precache manifest.
  buildExcludes: [/app-build-manifest\.json$/, /_next\/app-build-manifest\.json$/],
})(nextConfig);

export default pwaConfig;
