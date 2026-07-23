import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  overrides: [
    {
      files: ["**/*.json", "**/*.jsonc"],
      options: { trailingComma: "none" },
    },
    // Use single quotes for YAML files only.
    {
      files: ["**/*.yml", "**/*.yaml"],
      options: { singleQuote: true },
    },
  ],
  printWidth: 120,
  // Sort Tailwind classes (replaces Biome's useSortedClasses).
  sortImports: {
    ignoreCase: true,
    newlinesBetween: false,
    order: "asc",
  },
  trailingComma: "all",
});
