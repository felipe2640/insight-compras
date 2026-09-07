import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    environmentMatchGlobs: [["tests/cockpit/**", "jsdom"]],
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@core": path.resolve(__dirname, "./core"),
      "@adapters": path.resolve(__dirname, "./adapters"),
      "@config": path.resolve(__dirname, "./config"),
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
