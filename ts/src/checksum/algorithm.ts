import { Component } from "../domain.ts";

const _alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function numerify(value: string): bigint {
  return BigInt(
    Array.from(value)
      .map((c) => _alphabet.indexOf(c).toString())
      .join("")
  );
}

export function iso7064(
  n: bigint,
  mod: bigint,
  postProcess: (r: bigint) => bigint,
  nDigits = 2
): string {
  const result = postProcess(n % mod);
  return result.toString().padStart(nDigits, "0");
}

export function weighted(
  value: Iterable<string>,
  mod: number,
  weights: Iterable<number>
): number {
  let sum = 0;
  const wArr = Array.isArray(weights) ? weights : [...weights];
  const vArr = Array.isArray(value) ? value : [...value];
  const len = Math.min(wArr.length, vArr.length);
  for (let i = 0; i < len; i++) {
    sum += wArr[i] * Number.parseInt(vArr[i], 10);
  }
  return sum % mod;
}

export function luhn(value: string): string {
  const numerical = Array.from(value)
    .map((n) => _alphabet.indexOf(n).toString())
    .join("");
  const reversed = numerical.split("").reverse();
  const processed = reversed
    .map((n, i) => ((2 - (i % 2)) * Number.parseInt(n, 10)).toString())
    .join("");
  const digitSum = Array.from(processed).reduce(
    (sum, n) => sum + Number.parseInt(n, 10),
    0
  );
  return ((10 - (digitSum % 10)) % 10).toString();
}

export abstract class Algorithm {
  abstract readonly name: string;
  readonly accepts: Component[] = [
    Component.BANK_CODE,
    Component.BRANCH_CODE,
    Component.ACCOUNT_CODE,
  ];

  abstract compute(components: string[]): string;

  validate(components: string[], expected: string): boolean {
    return this.compute(components) === expected;
  }
}

export class ISO7064Mod97_10 extends Algorithm {
  readonly name: string = "iso7064_mod97_10";

  postProcess(r: bigint): bigint {
    return 98n - r;
  }

  preProcess(components: string[]): bigint {
    return numerify(components.join("")) * 100n;
  }

  compute(components: string[]): string {
    return iso7064(this.preProcess(components), 97n, (r) =>
      this.postProcess(r)
    );
  }
}

export const algorithms: Record<string, Algorithm> = {};

export function register(
  ...prefixes: string[]
): (algorithm: Algorithm) => void {
  return (algorithm: Algorithm) => {
    for (const prefix of prefixes) {
      algorithms[`${prefix}:${algorithm.name}`] = algorithm;
    }
  };
}

export function getAlgorithm(name: string): Algorithm | undefined {
  return algorithms[name];
}
