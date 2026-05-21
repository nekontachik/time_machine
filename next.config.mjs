import withPWA from "next-pwa";
import { withSentryConfig } from "@sentry/nextjs";

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
})(nextConfig);

export default withSentryConfig(pwaConfig, {
  // Sentry org + project — set via Vercel env vars
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Source map upload — only runs when SENTRY_AUTH_TOKEN is present (CI/Vercel)
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Suppress Sentry build output for cleaner CI logs
  silent: true,

  // Disable telemetry
  telemetry: false,

  // Webpack-level Sentry settings (migrated from deprecated top-level options)
  webpack: {
    autoInstrumentServerFunctions: true,
    autoInstrumentMiddleware: true,
    treeshake: {
      removeDebugLogging: true,
    },
  },
});
