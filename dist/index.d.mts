//#region schwifty-ts/src/common.d.ts
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
//#region schwifty-ts/src/bic.d.ts
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
//#region schwifty-ts/src/domain.d.ts
declare enum Component {
  ACCOUNT_ID = "account_id",
  ACCOUNT_TYPE = "account_type",
  ACCOUNT_CODE = "account_code",
  ACCOUNT_HOLDER_ID = "account_holder_id",
  CURRENCY_CODE = "currency_code",
  BANK_CODE = "bank_code",
  BRANCH_CODE = "branch_code",
  NATIONAL_CHECKSUM_DIGITS = "national_checksum_digits"
}
//#endregion
//#region schwifty-ts/src/types.d.ts
interface BankEntry {
  bank_code: string;
  bic: string;
  checksum_algo?: string;
  country_code: string;
  name: string;
  primary: boolean;
  short_name: string;
}
interface IbanSpec {
  bban_length: number;
  bban_spec: string;
  bic_lookup_components?: Component[];
  country: string;
  default_currency_code?: string;
  iban_length: number;
  iban_spec: string;
  in_sepa_zone: boolean;
  positions?: Record<string, [number, number]>;
  regex?: RegExp;
}
//#endregion
//#region schwifty-ts/src/bban.d.ts
declare class BBAN extends Base {
  readonly countryCode: string;
  constructor(countryCode: string, value: string);
  static fromComponents(countryCode: string, values: Record<string, string>): BBAN;
  static random(countryCode?: string, options?: {
    useRegistry?: boolean;
    values?: Record<string, string>;
  }): BBAN;
  validateNationalChecksum(): boolean;
  private _getComponent;
  get spec(): IbanSpec;
  get bic(): BIC | null;
  get nationalChecksumDigits(): string;
  get bankCode(): string;
  get branchCode(): string;
  get accountCode(): string;
  get accountId(): string;
  get accountType(): string;
  get accountHolderId(): string;
  get currencyCode(): string;
  get bank(): BankEntry | null;
  get bankName(): string | null;
  get bankShortName(): string | null;
}
//#endregion
//#region schwifty-ts/src/checksum/algorithm.d.ts
declare abstract class Algorithm {
  abstract readonly name: string;
  readonly accepts: Component[];
  abstract compute(components: string[]): string;
  validate(components: string[], expected: string): boolean;
}
declare const algorithms: Record<string, Algorithm>;
declare function getAlgorithm(name: string): Algorithm | undefined;
//#endregion
//#region schwifty-ts/src/exceptions.d.ts
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
//#region schwifty-ts/src/iban.d.ts
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
  get spec(): IbanSpec;
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
  get bank(): BankEntry | null;
  get bankName(): string | null;
  get bankShortName(): string | null;
  endsWith(suffix: string): boolean;
}
declare function convertBbanSpecToRegex(spec: string): string;
//#endregion
export { BBAN, BIC, Component, GenerateRandomOverflowError, IBAN, InvalidAccountCode, InvalidBBANChecksum, InvalidBankCode, InvalidBranchCode, InvalidChecksumDigits, InvalidCountryCode, InvalidLength, InvalidStructure, SchwiftyException, algorithms, convertBbanSpecToRegex, getAlgorithm };
//# sourceMappingURL=index.d.mts.map