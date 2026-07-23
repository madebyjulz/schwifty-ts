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
  overrides: [
    {
      files: ["scripts/**"],
      rules: {
        // Build-time CLI scripts report progress on stdout.
        "no-console": "off",
      },
    },
    {
      // The vitest preset ships these as `overrides`, which outrank the
      // top-level `rules` below, so the opt-outs have to be repeated here.
      files: ["**/*.{test,spec}.{ts,tsx,js,jsx}", "**/__tests__/**/*.{ts,tsx,js,jsx}"],
      plugins: ["vitest"],
      rules: {
        "vitest/max-expects": "off",
      },
    },
  ],
  rules: {
    "arrow-body-style": "off",
    // The checksum modules are one tiny class per national algorithm (46 of
    // them for Germany alone) and `exceptions.ts` is one class per error type.
    // Splitting either across files would obscure more than it reveals.
    "max-classes-per-file": "off",
    // The `Algorithm` hierarchy is built on template-method hooks
    // (`preProcess`, `computeSummand`, `reconcile`, ...). Base implementations
    // legitimately ignore `this`; making them static would break overriding.
    "class-methods-use-this": "off",
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
        // Overrides in the `Algorithm` hierarchy have to keep the full
        // signature even when a hook ignores an argument; `_`-prefixing marks
        // that deliberately.
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
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
    // Every string reaching this library is folded to printable ASCII by
    // `clean()`/`toAscii()` in `schwifty-ts/src/common.ts`, so spreading a
    // string into code points is exactly the per-character split we want.
    "typescript/no-misused-spread": "off",
    // Error class names mirror the public API of the Python `schwifty`
    // package (`SchwiftyException`, `InvalidLength`, ...) — renaming them to
    // an `Error` suffix would fork the API of the port.
    "unicorn/custom-error-definition": "off",
    // Modules are a 1:1 port of the `schwifty-py` submodule and keep its
    // snake_case module names so the two trees stay diff-able.
    "unicorn/filename-case": ["warn", { cases: { kebabCase: true, snakeCase: true } }],
    "unicorn/no-array-for-each": "off",
    "unicorn/no-array-reduce": "warn",
    "unicorn/no-nested-ternary": "off",
    // Don't flag `undefined` passed as a required argument (e.g. buildKey(key,
    // undefined) where the param is required but typed `undefined`).
    "unicorn/no-useless-undefined": ["error", { checkArguments: false }],
    // Allow `never` in template expressions for satisfy never type assertions in switch statements.
    "typescript/restrict-template-expressions": ["error", { allowNever: true }],
  },
});
