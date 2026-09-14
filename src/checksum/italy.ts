import { Algorithm, DIGITS, register, UPPERCASE } from "./algorithm.ts";

const LOWERCASE = UPPERCASE.toLowerCase();

const _CHAR_MAP: Record<string, number> = {};
for (const alphabet of [DIGITS, UPPERCASE, LOWERCASE]) {
  for (const [index, char] of [...alphabet].entries()) {
    _CHAR_MAP[char] = index;
  }
}

const _ODDS = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21, 2, 4, 18, 20, 11, 3, 6, 8, 12, 14, 16, 10, 22, 25, 24, 23] as const;

function getIndex(char: string): number {
  return _CHAR_MAP[char];
}

// Italy (IT), San Marino (SM)
class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";

  compute(components: string[]): string {
    const value = components.join("");
    let sum = 0;
    for (let i = 0; i < value.length; i++) {
      // oxlint-disable-next-line unicorn/prefer-ternary
      if ((i + 1) % 2 === 0) {
        sum += getIndex(value[i]);
      } else {
        sum += _ODDS[getIndex(value[i])];
      }
    }
    return UPPERCASE[sum % UPPERCASE.length];
  }
}

register("IT", "SM")(new DefaultAlgorithm());
