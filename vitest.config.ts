import { coverageConfigDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["src/index.ts", ...coverageConfigDefaults.exclude],
    },
  },
});
