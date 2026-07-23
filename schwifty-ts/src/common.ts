import { InvalidStructure } from "./exceptions.ts";

const _whitespaceRegex = /\s+/gu;
const _combiningMarkRegex = /\p{M}+/gu;
const _nonAsciiRegex = /[^ -~]/u;

/**
 * Fold a caller-supplied value into printable ASCII.
 *
 * IBANs, BICs and BBANs are defined over ASCII alone, so the value is first
 * normalised with NFKD to map the compatibility forms people routinely paste
 * (full-width digits, accented latin letters, ligatures) onto their ASCII
 * equivalents. Anything still outside printable ASCII afterwards is rejected
 * rather than dropped: silently deleting a stray character would turn a
 * malformed account number into a seemingly well-formed one.
 *
 * Every string entering this library passes through here, which is what makes
 * spreading a value into code points (`[...value]`) a safe per-character split.
 */
export function toAscii(value: string): string {
  const folded = value.normalize("NFKD").replace(_combiningMarkRegex, "");
  const offender = _nonAsciiRegex.exec(folded);
  if (offender) {
    throw new InvalidStructure(`Invalid non-ASCII character '${offender[0]}' in '${value}'`);
  }
  return folded;
}

export function clean(s: string): string {
  return toAscii(s.replace(_whitespaceRegex, "")).toUpperCase();
}

export class Base {
  protected _value: string;

  constructor(value: string) {
    this._value = clean(value);
  }

  toString(): string {
    return this._value;
  }

  valueOf(): string {
    return this._value;
  }

  [Symbol.toPrimitive](): string {
    return this._value;
  }

  get compact(): string {
    return this._value;
  }

  get length(): number {
    return this._value.length;
  }

  protected _getSlice(start: number, end?: number): string {
    if (start < this._value.length && (end === undefined || end <= this._value.length)) {
      return end === undefined ? this._value.slice(start) : this._value.slice(start, end);
    }
    return "";
  }

  equals(other: unknown): boolean {
    if (other instanceof Base) {
      return this._value === other._value;
    }
    return this._value === String(other);
  }

  lessThan(other: unknown): boolean {
    if (other instanceof Base) {
      return this._value < other._value;
    }
    return this._value < String(other);
  }

  repr(): string {
    return `<${this.constructor.name}=${this._value}>`;
  }
}
