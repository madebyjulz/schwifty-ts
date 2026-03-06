const _cleanRegex = /\s+/g;

export function clean(s: string): string {
  return s.replace(_cleanRegex, "").toUpperCase();
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
    if (
      start < this._value.length &&
      (end === undefined || end <= this._value.length)
    ) {
      return end !== undefined
        ? this._value.slice(start, end)
        : this._value.slice(start);
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
