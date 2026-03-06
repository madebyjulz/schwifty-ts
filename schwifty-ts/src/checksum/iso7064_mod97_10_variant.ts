import { ISO7064Mod97_10, register } from "./algorithm.ts";

// Mauretania (MR), Tunesia (TN)
class DefaultAlgorithm extends ISO7064Mod97_10 {
  override readonly name = "default";

  override postProcess(r: bigint): bigint {
    return 97n - r;
  }
}

register("MR", "TN")(new DefaultAlgorithm());
