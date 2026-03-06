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

const _specDefaults: Record<string, keyof IbanSpec> = {
  [Component.CURRENCY_CODE]: "default_currency_code",
};

function getSpecDefault(spec: IbanSpec, component: string): string | undefined {
  const field = _specDefaults[component];
  return field ? (spec[field] as string | undefined) : undefined;
}

function getBbanSpec(countryCode: string): IbanSpec {
  const specs = registry.get<Record<string, IbanSpec>>("iban");
  const result = specs[countryCode];
  if (!result) {
    throw new exceptions.InvalidCountryCode(
      `Unknown country-code '${countryCode}'`,
    );
  }
  return result;
}

function getPositionRange(spec: IbanSpec, componentType: Component): Range {
  const positions = spec.positions || {};
  const [start, end] = positions[componentType] || [0, 0];
  return { start, end };
}

function getPositionRanges(spec: IbanSpec): Record<Component, Range> {
  const result = {} as Record<Component, Range>;
  for (const component of Object.values(Component)) {
    result[component] = getPositionRange(spec, component);
  }
  return result;
}

function computeNationalChecksum(
  countryCode: string,
  components: Record<Component, string>,
): string {
  const algo = getAlgorithm(`${countryCode}:default`);
  if (!algo) {
    return "";
  }
  return algo.compute(algo.accepts.map((key) => components[key]));
}

export class BBAN extends Base {
  readonly countryCode: string;

  constructor(countryCode: string, value: string) {
    super(value);
    this.countryCode = countryCode;
  }

  static fromComponents(
    countryCode: string,
    values: Record<string, string>,
  ): BBAN {
    const spec = getBbanSpec(countryCode);
    if (!spec.positions) {
      throw new exceptions.SchwiftyException(
        `BBAN generation for ${countryCode} not supported`,
      );
    }

    const ranges = getPositionRanges(spec);
    const components = {} as Record<Component, string>;

    for (const [key, range] of Object.entries(ranges) as [Component, Range][]) {
      components[key] = clean(values[key] || "").padStart(
        rangeLength(range),
        "0",
      );
    }

    const bankCodeLength = rangeLength(ranges[Component.BANK_CODE]);
    const branchCodeLength = rangeLength(ranges[Component.BRANCH_CODE]);
    const accountCodeLength = rangeLength(ranges[Component.ACCOUNT_CODE]);

    if (
      components[Component.BANK_CODE].length ===
      bankCodeLength + branchCodeLength
    ) {
      components[Component.BRANCH_CODE] = components[Component.BANK_CODE].slice(
        bankCodeLength,
        bankCodeLength + branchCodeLength,
      );
      components[Component.BANK_CODE] = components[Component.BANK_CODE].slice(
        0,
        bankCodeLength,
      );
    }

    if (components[Component.BANK_CODE].length > bankCodeLength) {
      throw new exceptions.InvalidBankCode(
        `Bank code exceeds maximum size ${bankCodeLength}`,
      );
    }

    if (components[Component.BRANCH_CODE].length > branchCodeLength) {
      throw new exceptions.InvalidBranchCode(
        `Branch code exceeds maximum size ${branchCodeLength}`,
      );
    }

    if (components[Component.ACCOUNT_CODE].length > accountCodeLength) {
      throw new exceptions.InvalidAccountCode(
        `Account code exceeds maximum size ${accountCodeLength}`,
      );
    }

    const checksum = computeNationalChecksum(countryCode, components);
    if (checksum) {
      components[Component.NATIONAL_CHECKSUM_DIGITS] = checksum;
    }

    let bban = "0".repeat(spec.bban_length);
    for (const [key, value] of Object.entries(components) as [
      Component,
      string,
    ][]) {
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

    const banksByCountry = registry.get<Record<string, BankEntry[]>>("country");
    if (!countryCode) {
      const keys = Object.keys(banksByCountry);
      countryCode = keys[Math.floor(Math.random() * keys.length)];
    }

    const spec = getBbanSpec(countryCode);
    let bank: Partial<BankEntry> = {};
    const banks = banksByCountry[countryCode];
    if (banks && useRegistry) {
      bank = banks[Math.floor(Math.random() * banks.length)];
    }

    if (!spec.positions) {
      const regexStr = getRegexSource(spec);
      const bban = generateFromRegex(regexStr);
      return new BBAN(countryCode, bban);
    }

    const ranges = getPositionRanges(spec);
    for (let attempt = 0; attempt < 100; attempt++) {
      const regexStr = getRegexSource(spec);
      const randomBban = generateFromRegex(regexStr);
      const components = {} as Record<Component, string>;

      for (const [key, range] of Object.entries(ranges) as [
        Component,
        Range,
      ][]) {
        if (values[key] !== undefined) {
          components[key] = values[key];
        } else {
          components[key] =
            (bank as Record<string, string>)[key] ||
            getSpecDefault(spec, key) ||
            rangeCut(range, randomBban);
        }
      }

      const bankCode = components[Component.BANK_CODE];
      const bankCodeLength = rangeLength(ranges[Component.BANK_CODE]);
      const branchCodeLength = rangeLength(ranges[Component.BRANCH_CODE]);

      if (bankCode.length >= bankCodeLength + branchCodeLength) {
        const start = bankCodeLength;
        const end = start + branchCodeLength;
        components[Component.BRANCH_CODE] = bankCode.slice(start, end);
      }

      for (const [key, value] of Object.entries(components) as [
        Component,
        string,
      ][]) {
        components[key] = value.slice(0, rangeLength(ranges[key]));
      }

      try {
        return BBAN.fromComponents(countryCode, {
          ...Object.fromEntries(
            Object.entries(components).map(([k, v]) => [k, v]),
          ),
        });
      } catch (e) {
        if (e instanceof exceptions.SchwiftyException) {
          continue;
        }
        throw e;
      }
    }
    throw new exceptions.GenerateRandomOverflowError();
  }

  validateNationalChecksum(): boolean {
    const bank = this.bank;
    const algoName = bank?.checksum_algo || "default";
    const algo = getAlgorithm(`${this.countryCode}:${algoName}`);
    if (!algo) {
      return true;
    }
    const components = algo.accepts.map((component) =>
      this._getComponent(component),
    );
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
    const lookupBy: Component[] = this.spec.bic_lookup_components || [
      Component.BANK_CODE,
    ];
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
    const bankRegistry =
      registry.get<Record<string, BankEntry[]>>("bank_code");
    const lookupBy: Component[] = this.spec.bic_lookup_components || [
      Component.BANK_CODE,
    ];
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
registry.buildIndex("bank", "country", "country_code", true);

function getRegexSource(spec: IbanSpec): string {
  if (spec.regex instanceof RegExp) {
    return spec.regex.source;
  }
  return String(spec.regex)
    .replace(/^\/\^?/, "")
    .replace(/\$?\/$/, "");
}

// Simple random string generator from regex-like patterns
const CARET_RE = /^\^/;
const DOLLAR_RE = /\$$/;

function generateFromRegex(pattern: string): string {
  let result = "";
  let i = 0;
  const src = pattern.replace(CARET_RE, "").replace(DOLLAR_RE, "");

  while (i < src.length) {
    const ch = src[i];

    if (ch === "[") {
      const end = src.indexOf("]", i);
      const charClass = src.slice(i + 1, end);
      const chars = expandCharClass(charClass);
      i = end + 1;
      const [min, max, newI] = parseQuantifier(src, i);
      i = newI;
      const count = min + Math.floor(Math.random() * (max - min + 1));
      for (let j = 0; j < count; j++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    } else if (ch === "\\") {
      i++;
      const escaped = src[i];
      let chars: string;
      if (escaped === "d") {
        chars = "0123456789";
      } else {
        chars = escaped;
      }
      i++;
      const [min, max, newI] = parseQuantifier(src, i);
      i = newI;
      const count = min + Math.floor(Math.random() * (max - min + 1));
      for (let j = 0; j < count; j++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
    } else if (ch === " ") {
      i++;
      const [min, max, newI] = parseQuantifier(src, i);
      i = newI;
      const count = min + Math.floor(Math.random() * (max - min + 1));
      result += " ".repeat(count);
    } else {
      result += ch;
      i++;
    }
  }
  return result.toUpperCase();
}

function expandCharClass(cls: string): string {
  let result = "";
  let i = 0;
  while (i < cls.length) {
    if (i + 2 < cls.length && cls[i + 1] === "-") {
      const start = cls.charCodeAt(i);
      const end = cls.charCodeAt(i + 2);
      for (let c = start; c <= end; c++) {
        result += String.fromCharCode(c);
      }
      i += 3;
    } else {
      result += cls[i];
      i++;
    }
  }
  return result;
}

function parseQuantifier(src: string, i: number): [number, number, number] {
  if (i >= src.length) {
    return [1, 1, i];
  }
  if (src[i] === "{") {
    const end = src.indexOf("}", i);
    const inner = src.slice(i + 1, end);
    if (inner.includes(",")) {
      const [a, b] = inner.split(",");
      return [Number.parseInt(a, 10), Number.parseInt(b || a, 10), end + 1];
    }
    const n = Number.parseInt(inner, 10);
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
