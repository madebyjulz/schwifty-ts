import { Component } from "../domain.ts";

export const DIGITS = "0123456789";
export const UPPERCASE = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const _alphabet = DIGITS + UPPERCASE;

export function numerify(value: string): bigint {
  return BigInt([...value].map((c) => _alphabet.indexOf(c).toString()).join(""));
}

export function iso7064(n: bigint, mod: bigint, postProcess: (r: bigint) => bigint, nDigits = 2): string {
  const result = postProcess(n % mod);
  return result.toString().padStart(nDigits, "0");
}

export function weighted(value: Iterable<string>, mod: number, weights: Iterable<number>): number {
  const wArr = [...weights];
  const vArr = [...value];
  const len = Math.min(wArr.length, vArr.length);
  let sum = 0;
  for (let i = 0; i < len; i++) {
    sum += wArr[i] * Number(vArr[i]);
  }
  return sum % mod;
}

export function luhn(value: string): string {
  const numerical = [...value].map((n) => _alphabet.indexOf(n).toString()).join("");
  const reversed = [...numerical].toReversed();
  const processed = reversed.map((n, i) => ((2 - (i % 2)) * Number(n)).toString()).join("");
  const digitSum = [...processed].reduce((sum, n) => sum + Number(n), 0);
  return ((10 - (digitSum % 10)) % 10).toString();
}

export abstract class Algorithm {
  abstract readonly name: string;
  readonly accepts: Component[] = [Component.BANK_CODE, Component.BRANCH_CODE, Component.ACCOUNT_CODE];

  abstract compute(components: string[]): string;

  validate(components: string[], expected: string): boolean {
    return this.compute(components) === expected;
  }

  /**
   * Return `components` adjusted so that the checksum validates.
   *
   * Algorithms whose checksum occupies its own BBAN field are fully determined
   * by their inputs, so there is nothing to adjust and the components are
   * returned unchanged (the caller writes the computed checksum into the
   * separate field). Algorithms that embed a check digit inside one of the
   * accepted components override this to splice in a valid check digit,
   * returning `null` when the given input admits no valid one.
   */
  solve(components: string[]): string[] | null {
    return components;
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
    return iso7064(this.preProcess(components), 97n, (r) => this.postProcess(r));
  }
}

export const algorithms: Record<string, Algorithm> = {};

export function register(...prefixes: string[]): (algorithm: Algorithm) => void {
  return (algorithm: Algorithm) => {
    for (const prefix of prefixes) {
      algorithms[`${prefix}:${algorithm.name}`] = algorithm;
    }
  };
}

export function getAlgorithm(name: string): Algorithm | undefined {
  return algorithms[name];
}
