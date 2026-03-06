import { Algorithm, register } from "./algorithm.ts";

const DIGITS = "0123456789";
const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function getIndex(char: string): number {
  const di = DIGITS.indexOf(char);
  if (di !== -1) {
    return di;
  }
  return UPPERCASE.indexOf(char.toUpperCase());
}

// Italy (IT), San Marino (SM)
class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";

  compute(components: string[]): string {
    const value = components.join("");
    const odds = [
      1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16,
      10, 22, 25, 24, 23,
    ];
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      if ((i + 1) % 2 === 0) {
        sum += getIndex(value[i]);
      } else {
        sum += odds[getIndex(value[i])];
      }
    }
    return UPPERCASE[sum % 26];
  }
}

register("IT", "SM")(new DefaultAlgorithm());
