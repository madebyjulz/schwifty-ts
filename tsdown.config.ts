import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  hash: false,
  dts: true,
  tsconfig: "tsconfig.build.json",
  format: "esm",
  sourcemap: true,
  // The generated bank registry is a single multi-megabyte string; embedding
  // it a second time in the source map would double the package size.
  outputOptions: {
    sourcemapExcludeSources: true,
  },
});
