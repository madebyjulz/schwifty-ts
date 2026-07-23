import { BIC } from "./bic.ts";
import { getAlgorithm } from "./checksum/index.ts";
import { Base, clean } from "./common.ts";
import { Component } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";
import type { BankEntry, IbanSpec } from "./types.ts";

interface Range {
  end: number;
  start: number;
}

function rangeLength(r: Range): number {
  return r.end - r.start;
}

function rangeIsEmpty(r: Range): boolean {
  return r.start === 0 && r.end === 0;
}

function rangeCut(r: Range, s: string): string {
  return s.slice(r.start, r.end);
}

/** Components that fall back to a spec-level default when left unspecified. */
const _specDefaults: Partial<Record<Component, (spec: IbanSpec) => string | undefined>> = {
  [Component.CURRENCY_CODE]: (spec) => spec.default_currency_code,
};

function getSpecDefault(spec: IbanSpec, component: Component): string | undefined {
  return _specDefaults[component]?.(spec);
}

/**
 * Build a fully populated record by evaluating `make` for every component.
 *
 * Spelled out key by key rather than assembled from `Object.fromEntries` so
 * that the result is `Record<Component, T>` by construction — no cast, and a
 * newly added component becomes a compile error here.
 */
function componentRecord<T>(make: (component: Component) => T): Record<Component, T> {
  return {
    [Component.ACCOUNT_ID]: make(Component.ACCOUNT_ID),
    [Component.ACCOUNT_TYPE]: make(Component.ACCOUNT_TYPE),
    [Component.ACCOUNT_CODE]: make(Component.ACCOUNT_CODE),
    [Component.ACCOUNT_HOLDER_ID]: make(Component.ACCOUNT_HOLDER_ID),
    [Component.CURRENCY_CODE]: make(Component.CURRENCY_CODE),
    [Component.BANK_CODE]: make(Component.BANK_CODE),
    [Component.BRANCH_CODE]: make(Component.BRANCH_CODE),
    [Component.NATIONAL_CHECKSUM_DIGITS]: make(Component.NATIONAL_CHECKSUM_DIGITS),
  };
}

function componentEntries<T>(record: Record<Component, T>): [Component, T][] {
  return Object.values(Component).map((component) => [component, record[component]]);
}

/** The only `BankEntry` field that doubles as a BBAN component. */
function getBankValue(bank: Partial<BankEntry>, component: Component): string | undefined {
  return component === Component.BANK_CODE ? bank.bank_code : undefined;
}

function getBbanSpec(countryCode: string): IbanSpec {
  const specs = registry.get("iban");
  const result = specs[countryCode];
  if (!result) {
    throw new exceptions.InvalidCountryCode(`Unknown country-code '${countryCode}'`);
  }
  return result;
}

function getPositionRange(spec: IbanSpec, componentType: Component): Range {
  const positions = spec.positions || {};
  const [start, end] = positions[componentType] || [0, 0];
  return { start, end };
}

function getPositionRanges(spec: IbanSpec): Record<Component, Range> {
  return componentRecord((component) => getPositionRange(spec, component));
}

function computeNationalChecksum(countryCode: string, components: Record<Component, string>): string {
  const algo = getAlgorithm(`${countryCode}:default`);
  if (!algo) {
    return "";
  }
  return algo.compute(algo.accepts.map((key) => components[key]));
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/** Expand a character-class body such as `A-Z0-9` into every character it matches. */
function expandCharClass(cls: string): string {
  let result = "";
  let i = 0;
  while (i < cls.length) {
    const rangeStart = cls.codePointAt(i);
    const rangeEnd = cls.codePointAt(i + 2);
    if (cls[i + 1] === "-" && rangeStart !== undefined && rangeEnd !== undefined) {
      for (let c = rangeStart; c <= rangeEnd; c++) {
        result += String.fromCodePoint(c);
      }
      i += 3;
    } else {
      result += cls[i];
      i++;
    }
  }
  return result;
}

/** Read the quantifier at `i`, returning `[min, max, indexAfterQuantifier]`. */
function parseQuantifier(src: string, i: number): [number, number, number] {
  if (i >= src.length) {
    return [1, 1, i];
  }
  if (src[i] === "{") {
    const end = src.indexOf("}", i);
    const inner = src.slice(i + 1, end);
    if (inner.includes(",")) {
      const [min, max] = inner.split(",");
      return [Number(min), Number(max || min), end + 1];
    }
    const n = Number(inner);
    return [n, n, end + 1];
  }
  if (src[i] === "+") {
    return [1, 5, i + 1];
  }
  if (src[i] === "*") {
    return [0, 5, i + 1];
  }
  if (src[i] === "?") {
    return [0, 1, i + 1];
  }
  return [1, 1, i];
}

// Simple random string generator from regex-like patterns
const CARET_RE = /^\^/u;
const DOLLAR_RE = /\$$/u;

function generateFromRegex(pattern: string): string {
  let result = "";
  let i = 0;
  const src = pattern.replace(CARET_RE, "").replace(DOLLAR_RE, "");

  const repeat = (chars: string): void => {
    const [min, max, next] = parseQuantifier(src, i);
    i = next;
    const count = min + Math.floor(Math.random() * (max - min + 1));
    for (let j = 0; j < count; j++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  };

  while (i < src.length) {
    const ch = src[i];

    if (ch === "[") {
      const end = src.indexOf("]", i);
      const chars = expandCharClass(src.slice(i + 1, end));
      i = end + 1;
      repeat(chars);
    } else if (ch === "\\") {
      i++;
      const escaped = src[i];
      i++;
      repeat(escaped === "d" ? "0123456789" : escaped);
    } else if (ch === " ") {
      i++;
      repeat(" ");
    } else {
      result += ch;
      i++;
    }
  }
  return result.toUpperCase();
}

const LEADING_SLASH_CARET_RE = /^\/\^?/u;
const TRAILING_DOLLAR_SLASH_RE = /\$?\/$/u;

function getRegexSource(spec: IbanSpec): string {
  if (spec.regex instanceof RegExp) {
    return spec.regex.source;
  }
  return String(spec.regex).replace(LEADING_SLASH_CARET_RE, "").replace(TRAILING_DOLLAR_SLASH_RE, "");
}

export class BBAN extends Base {
  readonly countryCode: string;

  constructor(countryCode: string, value: string) {
    super(value);
    this.countryCode = countryCode;
  }

  static fromComponents(countryCode: string, values: Record<string, string>): BBAN {
    const spec = getBbanSpec(countryCode);
    if (!spec.positions) {
      throw new exceptions.SchwiftyException(`BBAN generation for ${countryCode} not supported`);
    }

    const ranges = getPositionRanges(spec);
    const components = componentRecord((component) =>
      clean(values[component] || "").padStart(rangeLength(ranges[component]), "0"),
    );

    const bankCodeLength = rangeLength(ranges[Component.BANK_CODE]);
    const branchCodeLength = rangeLength(ranges[Component.BRANCH_CODE]);
    const accountCodeLength = rangeLength(ranges[Component.ACCOUNT_CODE]);

    if (components[Component.BANK_CODE].length === bankCodeLength + branchCodeLength) {
      components[Component.BRANCH_CODE] = components[Component.BANK_CODE].slice(
        bankCodeLength,
        bankCodeLength + branchCodeLength,
      );
      components[Component.BANK_CODE] = components[Component.BANK_CODE].slice(0, bankCodeLength);
    }

    if (components[Component.BANK_CODE].length > bankCodeLength) {
      throw new exceptions.InvalidBankCode(`Bank code exceeds maximum size ${bankCodeLength}`);
    }

    if (components[Component.BRANCH_CODE].length > branchCodeLength) {
      throw new exceptions.InvalidBranchCode(`Branch code exceeds maximum size ${branchCodeLength}`);
    }

    if (components[Component.ACCOUNT_CODE].length > accountCodeLength) {
      throw new exceptions.InvalidAccountCode(`Account code exceeds maximum size ${accountCodeLength}`);
    }

    const checksum = computeNationalChecksum(countryCode, components);
    if (checksum) {
      components[Component.NATIONAL_CHECKSUM_DIGITS] = checksum;
    }

    let bban = "0".repeat(spec.bban_length);
    for (const [key, value] of componentEntries(components)) {
      const range = ranges[key];
      if (rangeIsEmpty(range)) {
        continue;
      }
      bban = bban.slice(0, range.start) + value + bban.slice(range.end);
    }

    return new BBAN(countryCode, bban);
  }

  static random(
    countryCode = "",
    options?: {
      useRegistry?: boolean;
      values?: Record<string, string>;
    },
  ): BBAN {
    const useRegistry = options?.useRegistry ?? true;
    const values = options?.values ?? {};

    const banksByCountry = registry.get("country");
    const country = countryCode || pickRandom(Object.keys(banksByCountry));

    const spec = getBbanSpec(country);
    const banks = banksByCountry[country];
    const bank: Partial<BankEntry> = banks && useRegistry ? pickRandom(banks) : {};

    if (!spec.positions) {
      return new BBAN(country, generateFromRegex(getRegexSource(spec)));
    }

    const ranges = getPositionRanges(spec);
    for (let attempt = 0; attempt < 100; attempt++) {
      const randomBban = generateFromRegex(getRegexSource(spec));
      // An explicitly supplied value wins even when blank; the remaining
      // sources are skipped when they are blank as well as when absent.
      const components = componentRecord(
        (component) =>
          values[component] ??
          (getBankValue(bank, component) || getSpecDefault(spec, component) || rangeCut(ranges[component], randomBban)),
      );

      const bankCode = components[Component.BANK_CODE];
      const bankCodeLength = rangeLength(ranges[Component.BANK_CODE]);
      const branchCodeLength = rangeLength(ranges[Component.BRANCH_CODE]);

      if (bankCode.length >= bankCodeLength + branchCodeLength) {
        components[Component.BRANCH_CODE] = bankCode.slice(bankCodeLength, bankCodeLength + branchCodeLength);
      }

      for (const [key, value] of componentEntries(components)) {
        components[key] = value.slice(0, rangeLength(ranges[key]));
      }

      try {
        return BBAN.fromComponents(country, Object.fromEntries(componentEntries(components)));
      } catch (error) {
        if (error instanceof exceptions.SchwiftyException) {
          continue;
        }
        throw error;
      }
    }
    throw new exceptions.GenerateRandomOverflowError();
  }

  validateNationalChecksum(): boolean {
    const { bank } = this;
    const algoName = bank?.checksum_algo || "default";
    const algo = getAlgorithm(`${this.countryCode}:${algoName}`);
    if (!algo) {
      return true;
    }
    const components = algo.accepts.map((component) => this._getComponent(component));
    if (!algo.validate(components, this.nationalChecksumDigits)) {
      throw new exceptions.InvalidBBANChecksum("Invalid national checksum");
    }
    return false;
  }

  private _getComponent(componentType: Component): string {
    const position = getPositionRange(this.spec, componentType);
    return this._getSlice(position.start, position.end);
  }

  get spec(): IbanSpec {
    return getBbanSpec(this.countryCode);
  }

  get bic(): BIC | null {
    const lookupBy: Component[] = this.spec.bic_lookup_components || [Component.BANK_CODE];
    const key = lookupBy.map((c) => this._getComponent(c)).join("");
    try {
      return BIC.fromBankCode(this.countryCode, key);
    } catch {
      return null;
    }
  }

  get nationalChecksumDigits(): string {
    return this._getComponent(Component.NATIONAL_CHECKSUM_DIGITS);
  }

  get bankCode(): string {
    return this._getComponent(Component.BANK_CODE);
  }

  get branchCode(): string {
    return this._getComponent(Component.BRANCH_CODE);
  }

  get accountCode(): string {
    return this._getComponent(Component.ACCOUNT_CODE);
  }

  get accountId(): string {
    return this._getComponent(Component.ACCOUNT_ID);
  }

  get accountType(): string {
    return this._getComponent(Component.ACCOUNT_TYPE);
  }

  get accountHolderId(): string {
    return this._getComponent(Component.ACCOUNT_HOLDER_ID);
  }

  get currencyCode(): string {
    return this._getComponent(Component.CURRENCY_CODE);
  }

  get bank(): BankEntry | null {
    const bankRegistry = registry.get("bank_code");
    const lookupBy: Component[] = this.spec.bic_lookup_components || [Component.BANK_CODE];
    const key = lookupBy.map((c) => this._getComponent(c)).join("");
    const bankEntry = bankRegistry[`${this.countryCode}\0${key}`];
    if (!bankEntry || bankEntry.length === 0) {
      return null;
    }
    return bankEntry[0];
  }

  get bankName(): string | null {
    return this.bank === null ? null : this.bank.name;
  }

  get bankShortName(): string | null {
    return this.bank === null ? null : this.bank.short_name;
  }
}

// Build country index
registry.buildIndex("country", "country_code");
