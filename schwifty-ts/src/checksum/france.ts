import { ISO7064Mod97_10, register } from "./algorithm.ts";

const numerics: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  A: "1",
  B: "2",
  C: "3",
  D: "4",
  E: "5",
  F: "6",
  G: "7",
  H: "8",
  I: "9",
  J: "1",
  K: "2",
  L: "3",
  M: "4",
  N: "5",
  O: "6",
  P: "7",
  Q: "8",
  R: "9",
  S: "2",
  T: "3",
  U: "4",
  V: "5",
  W: "6",
  X: "7",
  Y: "8",
  Z: "9",
};

function numerifyFR(value: string): bigint {
  return BigInt(
    Array.from(value)
      .map((c) => numerics[c])
      .join("")
  );
}

// France (FR), Monaco (MC)
class DefaultAlgorithm extends ISO7064Mod97_10 {
  override readonly name = "default";

  override preProcess(components: string[]): bigint {
    const [bankCode, branchCode, accountCode] = components;
    return (
      89n * numerifyFR(bankCode) +
      15n * numerifyFR(branchCode) +
      3n * numerifyFR(accountCode)
    );
  }

  override postProcess(r: bigint): bigint {
    return 97n - r;
  }
}

register("FR", "MC")(new DefaultAlgorithm());
