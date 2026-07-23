//#region src/common.d.ts
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
declare function toAscii(value: string): string;
declare function clean(s: string): string;
declare class Base {
  protected _value: string;
  constructor(value: string);
  toString(): string;
  valueOf(): string;
  [Symbol.toPrimitive](): string;
  get compact(): string;
  get length(): number;
  protected _getSlice(start: number, end?: number): string;
  equals(other: unknown): boolean;
  lessThan(other: unknown): boolean;
  repr(): string;
}
//#endregion
//#region src/bic.d.ts
declare class BIC extends Base {
  constructor(bic: string, options?: {
    allowInvalid?: boolean;
    enforceSwiftCompliance?: boolean;
  });
  static candidatesFromBankCode(countryCode: string, bankCode: string): BIC[];
  static fromBankCode(countryCode: string, bankCode: string): BIC;
  validate(enforceSwiftCompliance?: boolean): boolean;
  private _validateLength;
  private _validateStructure;
  private _validateCountryCode;
  get isValid(): boolean;
  get formatted(): string;
  private _lookupValues;
  get domesticBankCodes(): string[];
  get bankNames(): string[];
  get bankShortNames(): string[];
  get exists(): boolean;
  get type(): string;
  get country(): string | undefined;
  get bankCode(): string;
  get countryCode(): string;
  get locationCode(): string;
  get branchCode(): string;
}
//#endregion
//#region src/domain.d.ts
/**
 * The addressable parts of a BBAN.
 *
 * Modelled as a const object rather than a TypeScript `enum` so the module
 * stays erasable (see `erasableSyntaxOnly` in tsconfig.json) while keeping
 * `Component.BANK_CODE` and `Object.values(Component)` working as before.
 */
declare const Component: {
  readonly ACCOUNT_ID: "account_id";
  readonly ACCOUNT_TYPE: "account_type";
  readonly ACCOUNT_CODE: "account_code";
  readonly ACCOUNT_HOLDER_ID: "account_holder_id";
  readonly CURRENCY_CODE: "currency_code";
  readonly BANK_CODE: "bank_code";
  readonly BRANCH_CODE: "branch_code";
  readonly NATIONAL_CHECKSUM_DIGITS: "national_checksum_digits";
};
type Component = (typeof Component)[keyof typeof Component];
/** Half-open `[start, end)` slice of a BBAN occupied by one component. */
declare class Range {
  readonly start: number;
  readonly end: number;
  constructor(start?: number, end?: number);
  get length(): number;
  /** A component the country's BBAN layout does not define at all. */
  get isEmpty(): boolean;
  cut(s: string): string;
}
/** The country specific IBAN/BBAN specification, as parsed from the registry. */
interface IBANSpec {
  bban_length: number;
  bban_spec: string;
  /** Components whose concatenation keys the bank lookup. Never empty. */
  bic_lookup_components: Component[];
  country: string;
  /** Registry-level fallbacks keyed by their raw `default_*` name. */
  defaults: Record<string, string>;
  iban_length: number;
  iban_spec: string;
  in_sepa_zone: boolean;
  /** Populated for every component; undefined layouts collapse to an empty `Range`. */
  positions: Record<Component, Range>;
  regex: RegExp;
}
/** A bank as listed in the registry. */
interface Bank {
  bank_code: string;
  bic: string;
  /** Selects the national checksum method, e.g. the German `"13"`. */
  checksum_algo: string;
  country_code: string;
  name: string;
  primary: boolean;
  short_name: string | null;
}
//#endregion
//#region src/bban.d.ts
declare class BBAN extends Base {
  readonly countryCode: string;
  constructor(countryCode: string, value: string);
  static fromComponents(countryCode: string, values: Record<string, string>): BBAN;
  static random(countryCode?: string, options?: {
    useRegistry?: boolean;
    values?: Record<string, string>;
  }): BBAN;
  /**
   * Validate the national checksum digits.
   *
   * @throws {InvalidBBANChecksum} If the country specific BBAN checksum is invalid.
   */
  validateNationalChecksum(): boolean;
  private _getComponent;
  get spec(): IBANSpec;
  get bic(): BIC | null;
  private _bankLookupKey;
  get nationalChecksumDigits(): string;
  get bankCode(): string;
  get branchCode(): string;
  get accountCode(): string;
  get accountId(): string;
  get accountType(): string;
  get accountHolderId(): string;
  get currencyCode(): string;
  get bank(): Bank | null;
  get bankName(): string | null;
  get bankShortName(): string | null;
}
//#endregion
//#region src/checksum/algorithm.d.ts
declare abstract class Algorithm {
  abstract readonly name: string;
  readonly accepts: Component[];
  abstract compute(components: string[]): string;
  validate(components: string[], expected: string): boolean;
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
  solve(components: string[]): string[] | null;
}
declare const algorithms: Record<string, Algorithm>;
declare function getAlgorithm(name: string): Algorithm | undefined;
//#endregion
//#region src/exceptions.d.ts
declare class SchwiftyException extends Error {
  constructor(message?: string);
}
declare class InvalidLength extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidStructure extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidCountryCode extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidBankCode extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidBranchCode extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidAccountCode extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidChecksumDigits extends SchwiftyException {
  constructor(message?: string);
}
declare class InvalidBBANChecksum extends SchwiftyException {
  constructor(message?: string);
}
declare class GenerateRandomOverflowError extends SchwiftyException {
  constructor(message?: string);
}
//#endregion
//#region src/iban.d.ts
declare class IBAN extends Base {
  readonly bban: BBAN;
  constructor(iban: string, options?: {
    allowInvalid?: boolean;
    validateBban?: boolean;
  });
  static fromBban(countryCode: string, bban: string | BBAN, options?: {
    allowInvalid?: boolean;
    validateBban?: boolean;
  }): IBAN;
  static generate(countryCode: string, bankCode: string, accountCode: string, branchCode?: string, extra?: Record<string, string>): IBAN;
  static random(countryCode?: string, options?: {
    useRegistry?: boolean;
    values?: Record<string, string>;
  }): IBAN;
  validate(validateBban?: boolean): boolean;
  private _validateCharacters;
  private _validateLength;
  private _validateFormat;
  private _validateIbanChecksum;
  get isValid(): boolean;
  get numeric(): bigint;
  get formatted(): string;
  get spec(): IBANSpec;
  get bic(): BIC | null;
  get country(): string | undefined;
  get inSepaZone(): boolean;
  get countryCode(): string;
  get checksumDigits(): string;
  get nationalChecksumDigits(): string;
  get bankCode(): string;
  get branchCode(): string;
  get accountCode(): string;
  get accountId(): string;
  get accountType(): string;
  get accountHolderId(): string;
  get currencyCode(): string;
  get bank(): Bank | null;
  get bankName(): string | null;
  get bankShortName(): string | null;
  endsWith(suffix: string): boolean;
}
//#endregion
//#region src/registry.d.ts
/** Translate a SWIFT BBAN specification such as `8!n10!n` into a regex source. */
declare function convertBbanSpecToRegex(spec: string): string;
/**
 * The country specific IBAN specification.
 *
 * @throws {InvalidCountryCode} If the registry has no entry for `countryCode`.
 */
declare function getIbanSpec(countryCode: string): IBANSpec;
declare function getBanksByCountry(countryCode: string): Bank[];
declare function getBanksByCode(countryCode: string, bankCode: string): Bank[];
declare function getBanksByBic(bic: string): Bank[];
declare function getCountries(): string[];
declare function getAllBanks(): Bank[];
//#endregion
export { BBAN, BIC, type Bank, Component, GenerateRandomOverflowError, IBAN, type IBANSpec, InvalidAccountCode, InvalidBBANChecksum, InvalidBankCode, InvalidBranchCode, InvalidChecksumDigits, InvalidCountryCode, InvalidLength, InvalidStructure, Range, SchwiftyException, algorithms, clean, convertBbanSpecToRegex, getAlgorithm, getAllBanks, getBanksByBic, getBanksByCode, getBanksByCountry, getCountries, getIbanSpec, toAscii };
//# sourceMappingURL=index.d.mts.map