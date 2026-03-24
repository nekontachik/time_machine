/** @type {import('next').NextConfig} */
const nextConfig = {
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
      {
        protocol: "https",
        hostname: "oaidalleapiprodscus.blob.core.windows.net",
      },
    ],
  },
};

export default nextConfig;
