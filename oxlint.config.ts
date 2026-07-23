import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import tanstack from "ultracite/oxlint/tanstack";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, react, tanstack, next, vitest],
  globals: { __DEV__: "readonly" },
  ignorePatterns: [...(core.ignorePatterns ?? []), "**/.agents/**", "**/.claude/**"],
  options: {
    typeAware: true,
  },
  rules: {
    "arrow-body-style": "off",
    complexity: "off",
    curly: "off",
    "func-style": "off",
    "jsx-a11y/no-noninteractive-element-interactions": "warn",
    "no-console": ["warn", { allow: ["assert", "error", "info", "warn"] }],
    "no-empty": "off",
    "no-empty-function": "off",
    "no-inline-comments": "off",
    "no-nested-ternary": "off",
    "no-plusplus": "off",
    "no-unused-vars": [
      "warn",
      {
        fix: {
          imports: "safe-fix",
          variables: "off",
        },
      },
    ],
    "no-use-before-define": "warn",
    "no-void": "off",
    "no-warning-comments": "off",
    "node/no-process-env": "warn",
    "react/react-compiler": ["error", { reportAllBailouts: true }],
    "prefer-ternary": "warn",
    // `new Promise` is required to wrap callback/event/timeout APIs (readline,
    // child_process, canvas.toBlob, XHR progress, modal lifecycles, SSE abort).
    "promise/avoid-new": "off",
    "promise/prefer-await-to-callbacks": "warn",
    "require-await": "off",
    // Alphabetical key order keeps breaking TS contextual inference (TanStack
    // `onMutate` rollback context, nuqs `createParser`) and semantic orders
    // (drizzle pgTable columns, tRPC routers), so key order stays a human choice.
    "sort-keys": "off",
    "typescript/consistent-type-definitions": "off",
    "typescript/no-deprecated": "warn",
    "typescript/no-unnecessary-template-expression": "error",
    "typescript/unified-signatures": "off",
    "typescript/strict-boolean-expressions": "off",
    "typescript/prefer-nullish-coalescing": "off",
    "typescript/strict-void-return": "off",
    "typescript/no-confusing-void-expression": "off",
    "typescript/no-misused-promises": "warn",
    "unicorn/filename-case": "warn",
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-reduce": "warn",
    "unicorn/no-nested-ternary": "off",
    // Don't flag `undefined` passed as a required argument (e.g. buildKey(key,
    // undefined) where the param is required but typed `undefined`).
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    // Allow `never` in template expressions for satisfy never type assertions in switch statements.
    "typescript/restrict-template-expressions": ["error", { allowNever: true }],
    "vitest/max-expects": "off",
  },
});
