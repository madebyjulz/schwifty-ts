import { BIC } from "./bic.ts";
import type { Algorithm } from "./checksum/index.ts";
import { getAlgorithm } from "./checksum/index.ts";
import { Base, clean } from "./common.ts";
import type { Bank, IBANSpec } from "./domain.ts";
import { Component, componentEntries, componentRecord, hasPositions, Range } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";

/**
 * The national checksum is constructed rather than guessed, so a valid BBAN is
 * found on the first attempt for virtually every country and method. The only
 * residual regeneration is for the German mod-11 methods where roughly 1 in 11
 * random account bodies admits no valid check digit at all (the computation
 * lands on the reserved remainder); those bodies are simply regenerated. This
 * bound only backstops that regeneration — at that ~90% per-attempt success
 * rate exhausting it is impossible in practice (~0.1**200).
 */
const _MAX_RANDOM_ATTEMPTS = 200;

function getBbanSpec(countryCode: string): IBANSpec {
  return registry.getIbanSpec(countryCode);
}

function getNationalChecksumAlgorithm(countryCode: string, bank: Bank | null): Algorithm | undefined {
  const algoName = bank === null ? "default" : bank.checksum_algo;
  return getAlgorithm(`${countryCode}:${algoName}`);
}

/** The only `Bank` field that doubles as a BBAN component. */
function getBankValue(bank: Bank | null, component: Component): string | undefined {
  return bank !== null && component === Component.BANK_CODE ? bank.bank_code : undefined;
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

export class BBAN extends Base {
  readonly countryCode: string;

  constructor(countryCode: string, value: string) {
    super(value);
    this.countryCode = countryCode;
  }

  static fromComponents(countryCode: string, values: Record<string, string>): BBAN {
    const spec = getBbanSpec(countryCode);
    if (!hasPositions(spec)) {
      throw new exceptions.SchwiftyException(`BBAN generation for ${countryCode} not supported`);
    }

    const ranges = spec.positions;
    const components = componentRecord((component) =>
      clean(values[component] || "").padStart(ranges[component].length, "0"),
    );

    const bankCodeLength = ranges[Component.BANK_CODE].length;
    const branchCodeLength = ranges[Component.BRANCH_CODE].length;
    const accountCodeLength = ranges[Component.ACCOUNT_CODE].length;

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
      if (range.isEmpty) {
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

    const country = countryCode || pickRandom(registry.getCountries());
    const spec = getBbanSpec(country);

    const banks = registry.getBanksByCountry(country);
    const bank: Bank | null = banks.length > 0 && useRegistry ? pickRandom(banks) : null;

    if (!hasPositions(spec)) {
      return new BBAN(country, generateFromRegex(spec.regex.source));
    }

    const ranges = spec.positions;
    const algo = getNationalChecksumAlgorithm(country, bank);

    // Most countries carry the national checksum in its own BBAN field, which
    // `fromComponents` fills in deterministically, so the first iteration
    // already yields a valid BBAN. When the check digit is instead embedded
    // inside the account code (e.g. the many German methods) we don't guess:
    // `algo.solve` splices a valid check digit into the random account code.
    // The loop only re-runs on the rare occasions where a particular random
    // account body admits no valid check digit for the selected method.
    for (let attempt = 0; attempt < _MAX_RANDOM_ATTEMPTS; attempt++) {
      const randomBban = generateFromRegex(spec.regex.source);
      // An explicitly supplied value wins even when blank; the remaining
      // sources are skipped when they are blank as well as when absent.
      const components = componentRecord(
        (component) =>
          values[component] ??
          (getBankValue(bank, component) || spec.defaults[`default_${component}`] || ranges[component].cut(randomBban)),
      );

      const bankCode = components[Component.BANK_CODE];
      const bankCodeLength = ranges[Component.BANK_CODE].length;
      const branchCodeLength = ranges[Component.BRANCH_CODE].length;

      if (bankCode.length >= bankCodeLength + branchCodeLength) {
        components[Component.BRANCH_CODE] = bankCode.slice(bankCodeLength, bankCodeLength + branchCodeLength);
      }

      for (const [key, value] of componentEntries(components)) {
        components[key] = value.slice(0, ranges[key].length);
      }

      // Turn the randomly generated check digit(s) into a valid one instead of
      // rejecting and retrying. Skipped when the caller pinned every component
      // the algorithm consumes, since there is nothing left to adjust.
      if (algo !== undefined && !algo.accepts.some((component) => component in values)) {
        const solved = algo.solve(algo.accepts.map((component) => components[component]));
        if (solved === null) {
          continue;
        }
        for (const [index, component] of algo.accepts.entries()) {
          components[component] = solved[index];
        }
      }

      try {
        const bban = BBAN.fromComponents(country, Object.fromEntries(componentEntries(components)));
        bban.validateNationalChecksum();
        return bban;
      } catch (error) {
        if (error instanceof exceptions.SchwiftyException) {
          continue;
        }
        throw error;
      }
    }
    throw new exceptions.GenerateRandomOverflowError();
  }

  /**
   * Validate the national checksum digits.
   *
   * @throws {InvalidBBANChecksum} If the country specific BBAN checksum is invalid.
   */
  validateNationalChecksum(): boolean {
    const algo = getNationalChecksumAlgorithm(this.countryCode, this.bank);
    if (!algo) {
      return true;
    }
    const components = algo.accepts.map((component) => this._getComponent(component));
    if (!algo.validate(components, this.nationalChecksumDigits)) {
      throw new exceptions.InvalidBBANChecksum("Invalid national checksum");
    }
    return true;
  }

  private _getComponent(componentType: Component): string {
    const position = this.spec.positions[componentType] ?? new Range();
    return this._getSlice(position.start, position.end);
  }

  get spec(): IBANSpec {
    return getBbanSpec(this.countryCode);
  }

  get bic(): BIC | null {
    const key = this._bankLookupKey();
    try {
      return BIC.fromBankCode(this.countryCode, key);
    } catch {
      return null;
    }
  }

  private _bankLookupKey(): string {
    const lookupBy =
      this.spec.bic_lookup_components.length > 0 ? this.spec.bic_lookup_components : [Component.BANK_CODE];
    return lookupBy.map((component) => this._getComponent(component)).join("");
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

  get bank(): Bank | null {
    const banks = registry.getBanksByCode(this.countryCode, this._bankLookupKey());
    if (banks.length === 0) {
      return null;
    }
    return banks[0];
  }

  get bankName(): string | null {
    return this.bank === null ? null : this.bank.name;
  }

  get bankShortName(): string | null {
    return this.bank === null ? null : this.bank.short_name;
  }
}
