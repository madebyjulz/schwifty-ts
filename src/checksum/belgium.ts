import { ISO7064Mod97_10, mod97, register } from "./algorithm.ts";

class DefaultAlgorithm extends ISO7064Mod97_10 {
  override readonly name = "default";

  // Upstream divides the pre-processed integer by 100, i.e. it checks the
  // bare account number without the appended "00".
  override remainder(components: string[]): bigint {
    return BigInt(mod97(components.join("")));
  }

  override postProcess(r: bigint): bigint {
    return r === 0n ? 97n : r;
  }
}

register("BE")(new DefaultAlgorithm());
