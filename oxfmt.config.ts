import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  overrides: [
    {
      files: ["**/*.json", "**/*.jsonc"],
      options: { trailingComma: "none" },
    },
    {
      files: ["**/*.yml", "**/*.yaml"],
      options: { singleQuote: true },
    },
  ],
  printWidth: 120,
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: "asc",
  },
  trailingComma: "all",
});
