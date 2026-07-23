import { ISO7064Mod97_10, register } from "./algorithm.ts";

class DefaultAlgorithm extends ISO7064Mod97_10 {
  override readonly name = "default";

  override preProcess(components: string[]): bigint {
    return super.preProcess(components) / 100n;
  }

  override postProcess(r: bigint): bigint {
    return r === 0n ? 97n : r;
  }
}

register("BE")(new DefaultAlgorithm());
