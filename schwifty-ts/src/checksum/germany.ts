import { Component } from "../domain.ts";
import { InvalidBBANChecksum } from "../exceptions.ts";
import { Algorithm, register } from "./algorithm.ts";

// const ACCOUNT_CODE_LENGTH = 10;
const ZERO_PLUS_START_REGEX = /^0+/;
const ZERO_PLUS_REGEX = /0+$/;

interface Positions {
  checkDigit: number;
  end: number;
  start: number;
}

function digitSum(n: number): number {
  return String(n)
    .split("")
    .reduce((s, d) => s + Number.parseInt(d, 10), 0);
}

function cycle<T>(arr: T[], index: number): T {
  return arr[index % arr.length];
}

abstract class WeightedModulus extends Algorithm {
  override readonly accepts = [Component.ACCOUNT_CODE];
  abstract readonly modulus: number;
  abstract readonly positions: Positions;
  abstract readonly weights: number[];
  readonly minuend: number | null = null;
  readonly reverse: boolean = true;

  protected weightedSum = 0;
  protected _remainder = 0;

  compute(components: string[]): string {
    const [accountCode] = components;
    const digits = this.getDigits(this.adjustInput(accountCode));
    this._remainder = this.computeRemainder(this.computeWeightedSum(digits));
    const checksum =
      this.minuend === null ? this._remainder : this.minuend - this._remainder;
    return String(this.reconcile(checksum));
  }

  adjustInput(accountCode: string): string {
    return accountCode;
  }

  getDigits(accountCode: string): string {
    const positions = this.getPositions(accountCode);
    const start = positions.start - 1;
    const end = positions.end;
    let digits = accountCode.slice(start, end);
    if (this.reverse) {
      digits = digits.split("").reverse().join("");
    }
    return digits;
  }

  getPositions(_accountCode: string): Positions {
    return this.positions;
  }

  computeWeightedSum(digits: string): number {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      sum += this.computeSummand(
        Number.parseInt(digits[i], 10),
        cycle(this.weights, i)
      );
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
  private readonly minAccountCode = 6000;

  override computeSummand(digit: number, weight: number): number {
    return digitSum(digit * weight);
  }

  override compute(components: string[]): string {
    const [accountCode] = components;
    if (Number.parseInt(accountCode, 10) < this.minAccountCode) {
      return "";
    }
    return super.compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    const [accountCode] = components;
    if (Number.parseInt(accountCode, 10) < this.minAccountCode) {
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
    return checksum;
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
  override readonly positions: Positions = {
    start: 6,
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
    const firstDigit = Number.parseInt(digits[0], 10);
    if ([3, 4, 5, 6].includes(firstDigit)) {
      digits = digits.slice(1);
    } else if (firstDigit === 9) {
      digits = digits.slice(3);
    }
    // lstrip "0"
    digits = digits.replace(ZERO_PLUS_START_REGEX, "") || "0";
    return digits;
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
    if (
      this._remainder === 1 &&
      accountCode[1] !== "8" &&
      accountCode[1] !== "9"
    ) {
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
      const prefix = accountCode.split("").slice(8).reverse().join("");
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
    const [accountCode] = components;
    if (accountCode[0] !== "0") {
      return false;
    }
    return super.validate(components, expected);
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
        throw new InvalidBBANChecksum(
          "10 digit long account codes require the 7th digit to be set to 9"
        );
      }
      digits = digits.slice(0, 6);
    }
    return digits;
  }

  override validate(components: string[], expected: string): boolean {
    const [accountCode] = components;
    const acNum = Number.parseInt(accountCode, 10);
    if (acNum >= 400_000_000 && acNum <= 499_999_999) {
      return true;
    }
    if (super.validate(components, expected) === false) {
      const modifiedCode = `${accountCode.slice(0, 2)}00${accountCode.slice(4)}`;
      const checkDigit = this.compute([modifiedCode]);
      return checkDigit === accountCode[this.positions.checkDigit - 1];
    }
    return true;
  }
}
register("DE")(new Algorithm68());

// Algorithm 76
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

  override validate(components: string[], expected: string): boolean {
    const [accountCode] = components;
    const firstDigit = Number.parseInt(accountCode[0], 10);
    if (![0, 4, 6, 7, 8, 9].includes(firstDigit)) {
      return false;
    }
    return super.validate(components, expected);
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
class Algorithm91 extends Algorithm {
  override readonly name = "91";
  override readonly accepts = [Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    return new Algorithm91Variant1().compute(components);
  }

  override validate(components: string[], expected: string): boolean {
    const variants = [
      new Algorithm91Variant1(),
      new Algorithm91Variant2(),
      new Algorithm91Variant3(),
      new Algorithm91Variant4(),
    ];
    for (const variant of variants) {
      if (variant.validate(components, expected)) {
        return true;
      }
    }
    return false;
  }
}

class Algorithm91Variant1 extends WeightedMod11 {
  override readonly name: string = "91v1";
  override readonly positions: Positions = {
    start: 1,
    end: 6,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 5, 6, 7];
}

class Algorithm91Variant2 extends Algorithm91Variant1 {
  override readonly name: string = "91v2";
  override readonly weights = [7, 6, 5, 4, 3, 2];
}

class Algorithm91Variant3 extends Algorithm91Variant1 {
  override readonly name: string = "91v3";
  override readonly positions: Positions = {
    start: 1,
    end: 10,
    checkDigit: 7,
  };
  override readonly weights = [2, 3, 4, 0, 5, 6, 7, 8, 9, 10];
}

class Algorithm91Variant4 extends Algorithm91Variant1 {
  override readonly name: string = "91v4";
  override readonly weights = [2, 4, 8, 5, 10, 9];
}

register("DE")(new Algorithm91());

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
    const [accountCode] = components;
    if (accountCode === "0499999999" || accountCode === "0396000000") {
      return true;
    }
    return super.validate(components, expected);
  }
}
register("DE")(new Algorithm99());
