import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".."),
      // Stub server-only so client components can be imported in tests
      "server-only": path.resolve(__dirname, "../tests/__mocks__/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["tests/__mocks__/setup.ts"],
    include: ["tests/components/**/*.test.tsx"],
  },
});
