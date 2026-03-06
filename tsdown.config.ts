import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["schwifty-ts/src/index.ts"],
  hash: false,
  dts: true,
  tsconfig: "tsconfig.build.json",
  format: "esm",
  sourcemap: true,
});
