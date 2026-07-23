import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["schwifty-ts/tests/**/*.test.ts"],
  },
});
