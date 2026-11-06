import { Component } from "../domain.ts";
import { InvalidAccountCode, InvalidBBANChecksum } from "../exceptions.ts";
import { Algorithm, DIGITS, register } from "./algorithm.ts";

const ACCOUNT_CODE_LENGTH = 10;
const ZERO_PLUS_START_REGEX = /^0+/u;
const ZERO_PLUS_REGEX = /0+$/u;

interface Positions {
  checkDigit: number;
  end: number;
  start: number;
}

const DECIMAL_BASE = 10;
const TWO_DIGIT_LIMIT = 100;

export function digitSum(n: number): number {
  if (n < DECIMAL_BASE) {
    return n;
  }
  if (n < TWO_DIGIT_LIMIT) {
    return Math.floor(n / DECIMAL_BASE) + (n % DECIMAL_BASE);
  }
  return [...String(n)].reduce((s, d) => s + Number(d), 0);
}

/**
 * Return `accountCode` if it has the length all German methods expect.
 *
 * Methods that look at the account code themselves, before the shared check in
 * `WeightedModulus.getDigits` runs, have to call this first. Otherwise a BBAN
 * that is too short to carry an account code is checked against a truncated
 * value instead of raising `InvalidAccountCode`.
 */
function validateAccountCode(accountCode: string): string {
  if (accountCode.length !== ACCOUNT_CODE_LENGTH) {
    throw new InvalidAccountCode(`Account code must be ${ACCOUNT_CODE_LENGTH} digits long, got ${accountCode.length}`);
  }
  return accountCode;
}

function cycle<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

export abstract class WeightedModulus extends Algorithm {
  override readonly accepts = [Component.ACCOUNT_CODE];
  abstract readonly modulus: number;
  abstract readonly positions: Positions;
  abstract readonly weights: number[];
  readonly minuend: number | null = null;
  readonly reverse: boolean = true;

  protected _remainder = 0;

  compute(components: string[]): string {
    const [accountCode] = components;
    const digits = this.getDigits(this.adjustInput(accountCode));
    this._remainder = this.computeRemainder(this.computeWeightedSum(digits));
    const checksum = this.minuend === null ? this._remainder : this.minuend - this._remainder;
    return String(this.reconcile(checksum));
  }

  adjustInput(accountCode: string): string {
    return accountCode;
  }

  getDigits(accountCode: string): string {
    validateAccountCode(accountCode);
    const positions = this.getPositions(accountCode);
    const start = positions.start - 1;
    const { end } = positions;
    let digits = accountCode.slice(start, end);
    if (this.reverse) {
      digits = [...digits].toReversed().join("");
    }
    return digits;
  }

  getPositions(_accountCode: string): Positions {
    return this.positions;
  }

  computeWeightedSum(digits: string): number {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += this.computeSummand(Number(digits[i]), cycle(this.weights, i));
    }
    return sum;
  }

  computeSummand(digit: number, weight: number): number {
    return digit * weight;
  }

  computeRemainder(n: number): number {
    return n % this.modulus;
  }

  reconcile(checksum: number): number {
    return checksum >= 10 ? 0 : checksum;
  }

  override validate(components: string[], _expected: string): boolean {
    const accountCode = this.adjustInput(components[0]);
    const checkDigit = this.compute(components);
    const positions = this.getPositions(accountCode);
    return checkDigit === accountCode[positions.checkDigit - 1];
  }

  override solve(components: string[]): string[] | null {
    // The check digit sits at a fixed position inside the 10-digit account
    // code, so there is exactly one unknown to determine. Try every possible
    // value at that position and keep the one the method accepts, using the
    // existing `validate` as the oracle so per-method quirks (exception
    // ranges, special-case reconciliations) are honoured without duplicating
    // their logic. `null` signals that this random account body cannot be
    // made valid (e.g. methods that reject a whole class of inputs).
    const accountCode = validateAccountCode(components[0]);
    const index = this.getPositions(accountCode).checkDigit - 1;
    for (const digit of DIGITS) {
      const candidate = accountCode.slice(0, index) + digit + accountCode.slice(index + 1);
      try {
        if (this.validate([candidate], "")) {
          return [candidate];
        }
      } catch (error) {
        if (error instanceof InvalidBBANChecksum) {
          continue;
        }
        throw error;
      }
    }
    return null;
  }
}

abstract class WeightedMod10 extends WeightedModulus {
  override readonly modulus = 10;
  override readonly minuend: number | null = 10;
}

abstract class WeightedMod11 extends WeightedModulus {
  override readonly modulus = 11;
  override readonly minuend: number | null = 11;
}

// Algorithm 00
class Algorithm00 extends WeightedMod10 {
  override readonly name = "00";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(super.computeSummand(digit, weight));
  }
}
register("DE")(new Algorithm00());

// Algorithm 01
class Algorithm01 extends WeightedMod10 {
  override readonly name = "01";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [3, 7, 1];
}
register("DE")(new Algorithm01());

// Algorithm 02
class Algorithm02 extends WeightedMod11 {
  override readonly name = "02";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9];

  override reconcile(checksum: number): number {
    if (this._remainder === 0) {
      return 0;
    }
    if (this._remainder === 1) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }
}
register("DE")(new Algorithm02());

// Algorithm 03
class Algorithm03 extends WeightedMod10 {
  override readonly name = "03";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];
}
register("DE")(new Algorithm03());

// Algorithm 04
class Algorithm04 extends WeightedMod11 {
  override readonly name = "04";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override reconcile(checksum: number): number {
    if (this._remainder === 0) {
      return 0;
    }
    if (this._remainder === 1) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }
}
register("DE")(new Algorithm04());

// Algorithm 05
class Algorithm05 extends WeightedMod10 {
  override readonly name = "05";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [7, 3, 1];
}
register("DE")(new Algorithm05());

// Algorithm 06
class Algorithm06 extends WeightedMod11 {
  override readonly name = "06";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];
}
register("DE")(new Algorithm06());

// Algorithm 07
class Algorithm07 extends WeightedMod11 {
  override readonly name = "07";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  override reconcile(checksum: number): number {
    if (this._remainder === 0) {
      return 0;
    }
    if (this._remainder === 1) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }
}
register("DE")(new Algorithm07());

// Algorithm 08
class Algorithm08 extends WeightedMod10 {
  override readonly name = "08";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];
  // Per the Bundesbank specification the check digit only applies from account
  // number 60000 upward.
  private readonly minAccountCode = 60_000;

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override compute(components: string[]): string {
    const accountCode = validateAccountCode(components[0]);
    if (Number(accountCode) < this.minAccountCode) {
      return "";
    }
    return super.compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    if (Number(accountCode) < this.minAccountCode) {
      return true;
    }
    return super.validate(components, expected);
  }
}
register("DE")(new Algorithm08());

// Algorithm 09
class Algorithm09 extends Algorithm {
  override readonly name = "09";
  override readonly accepts = [Component.ACCOUNT_CODE];

  compute(_components: string[]): string {
    return "";
  }

  override validate(_components: string[], _expected: string): boolean {
    return true;
  }
}
register("DE")(new Algorithm09());

// Algorithm 10
class Algorithm10 extends WeightedMod11 {
  override readonly name = "10";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9, 10];
}
register("DE")(new Algorithm10());

// Algorithm 11
class Algorithm11 extends WeightedMod11 {
  override readonly name = "11";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9, 10];

  override reconcile(checksum: number): number {
    if (checksum === 10) {
      return 9;
    }
    // Anything else at or above 10 — in practice 11, i.e. a check digit of 0 —
    // falls back to the base method's mapping rather than being returned raw.
    return super.reconcile(checksum);
  }
}
register("DE")(new Algorithm11());

// Algorithm 13
class Algorithm13 extends WeightedMod10 {
  override readonly name = "13";
  override readonly positions: Positions = {
    start: 2,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    if (super.validate(components, expected)) {
      return true;
    }
    // The sub-account number "00" may be omitted, which moves the check digit to position 10.
    if (accountCode.startsWith("00")) {
      return super.validate([`${accountCode.slice(2)}00`], expected);
    }
    return false;
  }
}
register("DE")(new Algorithm13());

// Algorithm 14
class Algorithm14 extends WeightedMod11 {
  override readonly name = "14";
  override readonly positions: Positions = {
    start: 4,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override reconcile(checksum: number): number {
    if (this._remainder === 0) {
      return 0;
    }
    if (this._remainder === 1) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }
}
register("DE")(new Algorithm14());

// Algorithm 15
class Algorithm15 extends WeightedMod11 {
  override readonly name = "15";
  override readonly positions: Positions = {
    start: 6,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5];
}
register("DE")(new Algorithm15());

// Algorithm 16
class Algorithm16 extends WeightedMod11 {
  override readonly name = "16";
  // Method 16 is computed like method 06 over positions 1-9; only method 15 is
  // restricted to positions 6-9.
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override validate(components: string[], _expected: string): boolean {
    const [accountCode] = components;
    const checkDigit = this.compute(components);
    if (this._remainder === 1 && accountCode[8] === accountCode[9]) {
      return true;
    }
    return checkDigit === accountCode[this.positions.checkDigit - 1];
  }
}
register("DE")(new Algorithm16());

// Algorithm 17
class Algorithm17 extends WeightedMod11 {
  override readonly name = "17";
  override readonly minuend: number | null = 10;
  override readonly positions: Positions = {
    start: 2,
    end: 7,
    checkDigit: 8,
  };
  override readonly reverse = false;
  override readonly weights = [1, 2];

  override computeWeightedSum(digits: string): number {
    return super.computeWeightedSum(digits) - 1;
  }

  override computeSummand(digit: number, weight: number): number {
    return digitSum(super.computeSummand(digit, weight));
  }
}
register("DE")(new Algorithm17());

// Algorithm 18
class Algorithm18 extends WeightedMod10 {
  override readonly name = "18";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [3, 9, 7, 1];
}
register("DE")(new Algorithm18());

// Algorithm 19
class Algorithm19 extends WeightedMod11 {
  override readonly name = "19";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9, 1];
}
register("DE")(new Algorithm19());

// Algorithm 20
class Algorithm20 extends WeightedMod11 {
  override readonly name = "20";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9, 3];
}
register("DE")(new Algorithm20());

// Algorithm 21
class Algorithm21 extends WeightedMod10 {
  override readonly name = "21";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(super.computeSummand(digit, weight));
  }

  override computeRemainder(n: number): number {
    let num = n;
    while (num >= 10) {
      num = digitSum(num);
    }
    return num;
  }
}
register("DE")(new Algorithm21());

// Algorithm 22
class Algorithm22 extends WeightedMod10 {
  override readonly name = "22";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [3, 1];

  override computeSummand(digit: number, weight: number): number {
    return super.computeSummand(digit, weight) % 10;
  }
}
register("DE")(new Algorithm22());

// Algorithm 23
class Algorithm23 extends WeightedMod11 {
  override readonly name = "23";
  override readonly positions: Positions = {
    start: 1,
    end: 6,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override validate(components: string[], _expected: string): boolean {
    const [accountCode] = components;
    const checkDigit = this.compute(components);
    if (this._remainder === 1 && accountCode[5] === accountCode[6]) {
      return true;
    }
    return checkDigit === accountCode[this.positions.checkDigit - 1];
  }
}
register("DE")(new Algorithm23());

// Algorithm 24
class Algorithm24 extends WeightedMod10 {
  override readonly name = "24";
  override readonly minuend = null;
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly reverse = false;
  override readonly weights = [1, 2, 3];

  override getDigits(accountCode: string): string {
    let digits = super.getDigits(accountCode);
    const firstDigit = Number(digits[0]);
    if ([3, 4, 5, 6].includes(firstDigit)) {
      digits = digits.slice(1);
    } else if (firstDigit === 9) {
      digits = digits.slice(3);
    }
    return digits.replace(ZERO_PLUS_START_REGEX, "");
  }

  override computeSummand(digit: number, weight: number): number {
    return (super.computeSummand(digit, weight) + weight) % 11;
  }
}
register("DE")(new Algorithm24());

// Algorithm 25
class Algorithm25 extends WeightedMod11 {
  override readonly name = "25";
  override readonly positions: Positions = {
    start: 2,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9];

  override validate(components: string[], expected: string): boolean {
    const result = super.validate(components, expected);
    const [accountCode] = components;
    if (this._remainder === 1 && accountCode[1] !== "8" && accountCode[1] !== "9") {
      return false;
    }
    return result;
  }
}
register("DE")(new Algorithm25());

// Algorithm 26
class Algorithm26 extends WeightedMod11 {
  override readonly name = "26";
  override readonly positions: Positions = {
    start: 1,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override adjustInput(accountCode: string): string {
    if (accountCode.startsWith("00")) {
      return `${accountCode.slice(2)}00`;
    }
    return accountCode;
  }
}
register("DE")(new Algorithm26());

// Algorithm 28
class Algorithm28 extends WeightedMod11 {
  override readonly name = "28";
  override readonly positions: Positions = {
    start: 1,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8];
}
register("DE")(new Algorithm28());

// Algorithm 31
class Algorithm31 extends WeightedMod11 {
  override readonly name = "31";
  override readonly minuend = null;
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];

  override reconcile(checksum: number): number {
    // The remainder is the check digit, so there is none for a remainder of 10.
    if (this._remainder === 10) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }
}
register("DE")(new Algorithm31());

// Algorithm 32
class Algorithm32 extends WeightedMod11 {
  override readonly name = "32";
  override readonly positions: Positions = {
    start: 4,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];
}
register("DE")(new Algorithm32());

// Algorithm 33
class Algorithm33 extends WeightedMod11 {
  override readonly name = "33";
  override readonly positions: Positions = {
    start: 5,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6];
}
register("DE")(new Algorithm33());

// Algorithm 34
class Algorithm34 extends WeightedMod11 {
  override readonly name = "34";
  override readonly positions: Positions = {
    start: 1,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 4, 8, 5, 10, 9, 7];
}
register("DE")(new Algorithm34());

// Algorithm 38
class Algorithm38 extends WeightedMod11 {
  override readonly name = "38";
  override readonly positions: Positions = {
    start: 4,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 4, 8, 5, 10, 9];
}
register("DE")(new Algorithm38());

// Algorithm 40
class Algorithm40 extends WeightedMod11 {
  override readonly name = "40";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 4, 8, 5, 10, 9, 7, 3, 6];
}
register("DE")(new Algorithm40());

// Algorithm 41
class Algorithm41 extends WeightedMod10 {
  override readonly name = "41";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(super.computeSummand(digit, weight));
  }

  override getPositions(accountCode: string): Positions {
    // Positions 1 to 3 are not part of the calculation if position 4 is a 9.
    if (accountCode[3] === "9") {
      return { start: 4, end: 9, checkDigit: 10 };
    }
    return super.getPositions(accountCode);
  }
}
register("DE")(new Algorithm41());

// Algorithm 42
class Algorithm42 extends WeightedMod11 {
  override readonly name = "42";
  override readonly positions: Positions = {
    start: 2,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8, 9];
}
register("DE")(new Algorithm42());

// Algorithm 43
class Algorithm43 extends WeightedMod10 {
  override readonly name = "43";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [1, 2, 3, 4, 5, 6, 7, 8, 9];
}
register("DE")(new Algorithm43());

// Algorithm 44
class Algorithm44 extends WeightedMod11 {
  override readonly name = "44";
  override readonly positions: Positions = {
    start: 5,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 4, 8, 5, 10];
}
register("DE")(new Algorithm44());

// Algorithm 46
class Algorithm46 extends WeightedMod11 {
  override readonly name = "46";
  override readonly positions: Positions = {
    start: 3,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 3, 4, 5, 6];
}
register("DE")(new Algorithm46());

// Algorithm 47
class Algorithm47 extends WeightedMod11 {
  override readonly name = "47";
  override readonly positions: Positions = {
    start: 4,
    end: 8,
    checkDigit: 9,
  };
  override readonly weights = [2, 3, 4, 5, 6];
}
register("DE")(new Algorithm47());

// Algorithm 48
class Algorithm48 extends WeightedMod11 {
  override readonly name = "48";
  override readonly positions: Positions = {
    start: 3,
    end: 8,
    checkDigit: 9,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];
}
register("DE")(new Algorithm48());

// Algorithm 50
class Algorithm50 extends WeightedMod11 {
  override readonly name = "50";
  override readonly positions: Positions = {
    start: 1,
    end: 6,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    if (super.validate(components, expected)) {
      return true;
    }
    // The sub-account number "000" may be omitted and the account code padded with
    // leading zeros instead. Shift the account code three positions to the left and
    // check it again.
    if (accountCode.startsWith("000")) {
      return super.validate([`${accountCode.slice(3)}000`], expected);
    }
    return false;
  }
}
register("DE")(new Algorithm50());

// Algorithm 60
class Algorithm60 extends WeightedMod10 {
  override readonly name = "60";
  override readonly positions: Positions = {
    start: 3,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }
}
register("DE")(new Algorithm60());

// Algorithm 61
class Algorithm61 extends WeightedMod10 {
  override readonly name = "61";
  override readonly positions: Positions = {
    start: 1,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override getDigits(accountCode: string): string {
    let digits = super.getDigits(accountCode);
    if (accountCode[8] === "8") {
      // Python: account_code[:7:-1] = chars from end down to index 8 (exclusive of 7)
      // For 10-char string: indices 9, 8
      const prefix = [...accountCode].slice(8).toReversed().join("");
      digits = prefix + digits;
    }
    return digits;
  }
}
register("DE")(new Algorithm61());

// Algorithm 63
class Algorithm63 extends WeightedMod10 {
  override readonly name = "63";
  override readonly positions: Positions = {
    start: 2,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    if (!accountCode.startsWith("0")) {
      return false;
    }
    if (super.validate(components, expected)) {
      return true;
    }
    // The sub-account number "00" may be omitted and the account code padded with
    // leading zeros instead. The check digit then sits at position 10, so shift the
    // account code back into place and check it again.
    if (accountCode.startsWith("000")) {
      return super.validate([`${accountCode.slice(2)}00`], expected);
    }
    return false;
  }

  override solve(components: string[]): string[] | null {
    // The method only accepts account codes with a leading zero, which the check
    // digit alone cannot supply, so set it before solving for the check digit.
    const accountCode = validateAccountCode(components[0]);
    return super.solve([`0${accountCode.slice(1)}`]);
  }
}
register("DE")(new Algorithm63());

// Algorithm 68
class Algorithm68 extends WeightedMod10 {
  override readonly name = "68";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 1];

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override getDigits(accountCode: string): string {
    let digits = super.getDigits(accountCode);
    // Strip trailing zeros (digits are reversed, so rstrip becomes trimming end)
    digits = digits.replace(ZERO_PLUS_REGEX, "");
    if (digits.length === 9) {
      if (digits[5] !== "9") {
        throw new InvalidBBANChecksum("10 digit long account codes require the 7th digit to be set to 9");
      }
      digits = digits.slice(0, 6);
    }
    return digits;
  }

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    const acNum = Number(accountCode);
    if (acNum >= 400_000_000 && acNum <= 499_999_999) {
      return true;
    }
    if (!super.validate(components, expected)) {
      const modifiedCode = `${accountCode.slice(0, 2)}00${accountCode.slice(4)}`;
      const checkDigit = this.compute([modifiedCode]);
      return checkDigit === accountCode[this.positions.checkDigit - 1];
    }
    return true;
  }

  override solve(components: string[]): string[] | null {
    // A 10-significant-digit account code (no leading zero) requires the 7th
    // position — index 3 — to be 9, otherwise `getDigits` rejects it. Set it so
    // the leading digit stays free, then solve for the check digit.
    const accountCode = validateAccountCode(components[0]);
    if (accountCode.startsWith("0")) {
      return super.solve([accountCode]);
    }
    return super.solve([`${accountCode.slice(0, 3)}9${accountCode.slice(4)}`]);
  }
}
register("DE")(new Algorithm68());

// Algorithm 76
const ALLOWED_LEADING_DIGITS_76 = new Set([0, 4, 6, 7, 8, 9]);

class Algorithm76 extends WeightedMod11 {
  override readonly name = "76";
  override readonly minuend = null;
  override readonly positions: Positions = {
    start: 2,
    end: 7,
    checkDigit: 8,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8];

  override getDigits(accountCode: string): string {
    let digits = super.getDigits(accountCode);
    digits = digits.replace(ZERO_PLUS_REGEX, "");
    return digits;
  }

  override reconcile(checksum: number): number {
    // The remainder is the check digit, so there is none for a remainder of 10.
    if (this._remainder === 10) {
      throw new InvalidBBANChecksum(`Invalid remainder: ${this._remainder}`);
    }
    return checksum;
  }

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    if (!ALLOWED_LEADING_DIGITS_76.has(Number(accountCode[0]))) {
      return false;
    }
    // A remainder of 10 only rules out a check digit at position 8, so the account
    // code is still checked without the sub-account below.
    try {
      if (super.validate(components, expected)) {
        return true;
      }
    } catch (error) {
      if (!(error instanceof InvalidBBANChecksum)) {
        throw error;
      }
    }
    // The sub-account number "00" may be omitted and the account code padded with
    // leading zeros instead, which moves the check digit to position 10.
    if (accountCode.startsWith("00") && ALLOWED_LEADING_DIGITS_76.has(Number(accountCode[2]))) {
      return super.validate([`${accountCode.slice(2)}00`], expected);
    }
    return false;
  }

  override solve(components: string[]): string[] | null {
    // The method only accepts certain leading digits, which the check digit alone
    // cannot supply, so coerce it into the allowed set before solving.
    const accountCode = validateAccountCode(components[0]);
    if (ALLOWED_LEADING_DIGITS_76.has(Number(accountCode[0]))) {
      return super.solve([accountCode]);
    }
    return super.solve([`0${accountCode.slice(1)}`]);
  }
}
register("DE")(new Algorithm76());

// Algorithm 88
class Algorithm88 extends WeightedMod11 {
  override readonly name = "88";
  override readonly positions: Positions = {
    start: 4,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7, 8];

  override getPositions(accountCode: string): Positions {
    if (accountCode[2] === "9") {
      return { start: 3, end: 9, checkDigit: 10 };
    }
    return super.getPositions(accountCode);
  }
}
register("DE")(new Algorithm88());

// Algorithm 91
export class Algorithm91Variant1 extends WeightedMod11 {
  override readonly name: string = "91v1";
  override readonly positions: Positions = {
    start: 1,
    end: 6,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];
}

export class Algorithm91Variant2 extends Algorithm91Variant1 {
  override readonly name: string = "91v2";
  override readonly weights = [7, 6, 5, 4, 3, 2];
}

export class Algorithm91Variant3 extends Algorithm91Variant1 {
  override readonly name: string = "91v3";
  override readonly positions: Positions = {
    start: 1,
    end: 10,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 0, 5, 6, 7, 8, 9, 10];
}

export class Algorithm91Variant4 extends Algorithm91Variant1 {
  override readonly name: string = "91v4";
  override readonly weights = [2, 4, 8, 5, 10, 9];
}

class Algorithm91 extends Algorithm {
  override readonly name = "91";
  override readonly accepts = [Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    return new Algorithm91Variant1().compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    return Algorithm91._variants().some((variant) => variant.validate(components, expected));
  }

  override solve(components: string[]): string[] | null {
    for (const variant of Algorithm91._variants()) {
      const solved = variant.solve(components);
      if (solved !== null && this.validate(solved, "")) {
        return solved;
      }
    }
    return null;
  }

  private static _variants(): WeightedModulus[] {
    return [new Algorithm91Variant1(), new Algorithm91Variant2(), new Algorithm91Variant3(), new Algorithm91Variant4()];
  }
}
register("DE")(new Algorithm91());

// Algorithm 95
class Algorithm95 extends WeightedMod11 {
  override readonly name = "95";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override validate(components: string[], expected: string): boolean {
    const [accountCode] = components;
    if (!accountCode) {
      return false;
    }
    const number = Number(accountCode);
    if (
      (number >= 1 && number <= 1_999_999) ||
      (number >= 9_000_000 && number <= 25_999_999) ||
      (number >= 396_000_000 && number <= 499_999_999) ||
      (number >= 700_000_000 && number <= 799_999_999) ||
      (number >= 910_000_000 && number <= 989_999_999)
    ) {
      return true;
    }
    return super.validate(components, expected);
  }
}
register("DE")(new Algorithm95());

// Algorithm 99
class Algorithm99 extends WeightedMod11 {
  override readonly name = "99";
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];

  override validate(components: string[], expected: string): boolean {
    const accountCode = validateAccountCode(components[0]);
    const acNum = Number(accountCode);
    if (acNum >= 396_000_000 && acNum <= 499_999_999) {
      return true;
    }
    return super.validate(components, expected);
  }
}
register("DE")(new Algorithm99());

/** Check the account code with the second variant if the first one rejects it. */
abstract class FallbackVariants extends Algorithm {
  override readonly accepts = [Component.ACCOUNT_CODE];
  abstract readonly variants: readonly [new () => WeightedModulus, new () => WeightedModulus];

  compute(components: string[]): string {
    return new this.variants[0]().compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    return this.variants.some((AlgoCls) => new AlgoCls().validate(components, expected));
  }

  override solve(components: string[]): string[] | null {
    return new this.variants[0]().solve(components);
  }
}

// Algorithm 49
class Algorithm49 extends FallbackVariants {
  override readonly name = "49";
  override readonly variants: readonly [new () => WeightedModulus, new () => WeightedModulus] = [
    Algorithm00,
    Algorithm01,
  ];
}
register("DE")(new Algorithm49());

// Algorithm A2
class AlgorithmA2 extends FallbackVariants {
  override readonly name = "A2";
  override readonly variants: readonly [new () => WeightedModulus, new () => WeightedModulus] = [
    Algorithm00,
    Algorithm04,
  ];
}
register("DE")(new AlgorithmA2());

// Algorithm A3
class AlgorithmA3 extends FallbackVariants {
  override readonly name = "A3";
  override readonly variants: readonly [new () => WeightedModulus, new () => WeightedModulus] = [
    Algorithm00,
    Algorithm10,
  ];
}
register("DE")(new AlgorithmA3());

// Algorithm A7
class AlgorithmA7 extends FallbackVariants {
  override readonly name = "A7";
  override readonly variants: readonly [new () => WeightedModulus, new () => WeightedModulus] = [
    Algorithm00,
    Algorithm03,
  ];
}
register("DE")(new AlgorithmA7());

/** Method 17 over positions 1 to 9, the variant of method C1 for account codes starting with 5. */
class AlgorithmC1Variant2 extends Algorithm17 {
  override readonly positions: Positions = {
    start: 1,
    end: 9,
    checkDigit: 10,
  };
}

/**
 * Method 17, or a variant of it over positions 1-9 for account codes starting with 5.
 *
 * Unlike `FallbackVariants`, the leading digit selects the variant, so an account
 * code rejected by that variant is invalid and the other one is not tried.
 */
class AlgorithmC1 extends Algorithm {
  override readonly name = "C1";
  override readonly accepts = [Component.ACCOUNT_CODE];

  getVariant(accountCode: string): WeightedModulus {
    if (validateAccountCode(accountCode).startsWith("5")) {
      return new AlgorithmC1Variant2();
    }
    return new Algorithm17();
  }

  compute(components: string[]): string {
    return this.getVariant(components[0]).compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    return this.getVariant(components[0]).validate(components, expected);
  }

  override solve(components: string[]): string[] | null {
    return this.getVariant(components[0]).solve(components);
  }
}
register("DE")(new AlgorithmC1());

/**
 * Method 52 for account codes with exactly two leading zeros, otherwise method 20.
 *
 * Method 52 checks the account number of the former ESER system, which is built from the
 * bank code and the account code, so unlike the other German methods this one needs the
 * bank code too. An account code rejected by method 52 is checked with method 20 as well.
 */
class AlgorithmC0 extends Algorithm {
  override readonly name = "C0";
  override readonly accepts = [Component.BANK_CODE, Component.ACCOUNT_CODE];
  readonly eserWeights = [2, 4, 8, 5, 10, 9, 7, 3, 6, 1, 2, 4];

  static hasTwoLeadingZeros(accountCode: string): boolean {
    return accountCode.startsWith("00") && accountCode[2] !== "0";
  }

  /** Return the method 52 check digit, or an empty string if there is none. */
  computeEser(bankCode: string, accountCode: string): string {
    // Bank code XXX5XXXX and account code 00XPXXXXXX give the ESER account number
    // XXXX-XP-XXXXXX, with the leading zeros of the last part dropped.
    const tail = accountCode.slice(4).replace(ZERO_PLUS_START_REGEX, "");
    const digits = [...`${bankCode.slice(4, 8)}${accountCode[2]}0${tail}`].toReversed();
    let sum = 0;
    for (const [index, weight] of this.eserWeights.entries()) {
      sum += Number(digits[index] ?? 0) * weight;
    }
    const remainder = sum % 11;
    const weight = this.eserWeights[tail.length];
    for (const checkDigit of DIGITS) {
      if ((remainder + Number(checkDigit) * weight) % 11 === 10) {
        return checkDigit;
      }
    }
    return "";
  }

  compute(components: string[]): string {
    const [bankCode, accountCode] = components;
    if (AlgorithmC0.hasTwoLeadingZeros(validateAccountCode(accountCode))) {
      return this.computeEser(bankCode, accountCode);
    }
    return new Algorithm20().compute([accountCode]);
  }

  override validate(components: string[], expected: string): boolean {
    const [bankCode, accountCode] = components;
    if (
      AlgorithmC0.hasTwoLeadingZeros(validateAccountCode(accountCode)) &&
      this.computeEser(bankCode, accountCode) === accountCode[3]
    ) {
      return true;
    }
    return new Algorithm20().validate([accountCode], expected);
  }

  override solve(components: string[]): string[] | null {
    // Method 20 applies to every account code and always yields a check digit.
    const [bankCode, accountCode] = components;
    const solved = new Algorithm20().solve([accountCode]);
    return solved === null ? null : [bankCode, ...solved];
  }
}
register("DE")(new AlgorithmC0());
