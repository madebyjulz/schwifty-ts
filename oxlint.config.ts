import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

// Opt-outs exist because the code mirrors the Python `schwifty` package 1:1
// (function declarations, snake_case files, hook methods, exception names).
export default defineConfig({
  extends: [core, vitest],
  ignorePatterns: [...(core.ignorePatterns ?? []), "**/.claude/**"],
  options: { typeAware: true },
  overrides: [
    {
      files: ["scripts/**"],
      rules: { "no-console": "off" },
    },
    {
      files: ["**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__tests__/**/*.{ts,tsx,js,jsx}"],
      plugins: ["vitest"],
      rules: {
        "no-inline-comments": "off",
        "vitest/max-expects": "off",
      },
    },
  ],
  rules: {
    "class-methods-use-this": "off",
    "func-style": "off",
    "max-classes-per-file": "off",
    "no-console": "error",
    "no-plusplus": "off",
    "sort-keys": "off",
    // Inputs are folded to ASCII by `clean()`, so spreading a string is safe.
    "typescript/no-misused-spread": "off",
    "typescript/prefer-nullish-coalescing": "off",
    "typescript/strict-boolean-expressions": "off",
    "unicorn/custom-error-definition": "off",
    "unicorn/filename-case": ["error", { cases: { kebabCase: true, snakeCase: true } }],
  },
});
