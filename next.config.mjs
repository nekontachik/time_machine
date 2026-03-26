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
      // fal.ai — Flux image generation + Kling video thumbnails
      { protocol: "https", hostname: "fal.media" },
      { protocol: "https", hostname: "*.fal.media" },
      { protocol: "https", hostname: "storage.googleapis.com" },
      // Tavily — thumbnail images from web search results
      { protocol: "https", hostname: "**" },
    ],
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
})(nextConfig);
