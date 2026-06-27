import { defineConfig, configDefaults } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: [
      ...configDefaults.exclude,
      "**/node_modules.nosync/**",
      "**/node_modules.broken/**",
      "**/.next.broken/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
