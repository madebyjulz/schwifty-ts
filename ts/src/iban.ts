import { BBAN } from "./bban.ts";
import type { BIC } from "./bic.ts";
import { ISO7064Mod97_10, numerify } from "./checksum/index.ts";
import { Base } from "./common.ts";
import { getCountry } from "./countries.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";
import type { BankEntry, IbanSpec } from "./types.ts";

const _specToRe: Record<string, string> = {
  n: "\\d",
  a: "[A-Z]",
  c: "[A-Za-z0-9]",
  e: " ",
};

export class IBAN extends Base {
  readonly bban: BBAN;

  constructor(
    iban: string,
    options?: { allowInvalid?: boolean; validateBban?: boolean }
  ) {
    super(iban);
    this.bban = new BBAN(this.countryCode, this._getSlice(4));
    if (!options?.allowInvalid) {
      this.validate(options?.validateBban ?? false);
    }
  }

  static fromBban(
    countryCode: string,
    bban: string | BBAN,
    options?: { allowInvalid?: boolean; validateBban?: boolean }
  ): IBAN {
    const bbanStr = typeof bban === "string" ? bban : bban.compact;
    const checksumAlgo = new ISO7064Mod97_10();
    const checkDigits = checksumAlgo.compute([bbanStr, countryCode]);
    return new IBAN(countryCode + checkDigits + bbanStr, options);
  }

  static generate(
    countryCode: string,
    bankCode: string,
    accountCode: string,
    branchCode = "",
    extra?: Record<string, string>
  ): IBAN {
    return IBAN.fromBban(
      countryCode,
      BBAN.fromComponents(countryCode, {
        bank_code: bankCode,
        branch_code: branchCode,
        account_code: accountCode,
        ...extra,
      })
    );
  }

  static random(
    countryCode = "",
    options?: { useRegistry?: boolean; values?: Record<string, string> }
  ): IBAN {
    const bban = BBAN.random(countryCode, {
      useRegistry: options?.useRegistry,
      values: options?.values,
    });
    return IBAN.fromBban(bban.countryCode, bban);
  }

  validate(validateBban = false): boolean {
    this._validateCharacters();
    this._validateLength();
    this._validateFormat();
    this._validateIbanChecksum();
    if (validateBban) {
      this.bban.validateNationalChecksum();
    }
    return true;
  }

  private _validateCharacters(): void {
    if (!/^[A-Z]{2}\d{2}[A-Z]*/.test(this._value)) {
      throw new exceptions.InvalidStructure(
        `Invalid characters in IBAN ${this._value}`
      );
    }
  }

  private _validateLength(): void {
    if (this.spec.iban_length !== this.length) {
      throw new exceptions.InvalidLength("Invalid IBAN length");
    }
  }

  private _validateFormat(): void {
    const { regex } = this.spec;
    if (regex instanceof RegExp && !regex.test(this.bban.compact)) {
      throw new exceptions.InvalidStructure(
        `Invalid BBAN structure: '${this.bban}' doesn't match '${this.spec.bban_spec}'`
      );
    }
  }

  private _validateIbanChecksum(): void {
    const checksumAlgo = new ISO7064Mod97_10();
    if (
      this.numeric % 97n !== 1n ||
      !checksumAlgo.validate(
        [this.bban.compact, this.countryCode],
        this.checksumDigits
      )
    ) {
      throw new exceptions.InvalidChecksumDigits("Invalid checksum digits");
    }
  }

  get isValid(): boolean {
    try {
      return this.validate();
    } catch {
      return false;
    }
  }

  get numeric(): bigint {
    return numerify(this.bban.compact + this._value.slice(0, 4));
  }

  get formatted(): string {
    const parts: string[] = [];
    for (let i = 0; i < this.length; i += 4) {
      parts.push(this._value.slice(i, i + 4));
    }
    return parts.join(" ");
  }

  get spec(): IbanSpec {
    const specs = registry.get<Record<string, IbanSpec>>("iban");
    const countrySpec = specs[this.countryCode];
    if (!countrySpec) {
      throw new exceptions.InvalidCountryCode(
        `Unknown country-code '${this.countryCode}'`
      );
    }
    return countrySpec;
  }

  get bic(): BIC | null {
    return this.bban.bic;
  }

  get country(): string | undefined {
    return getCountry(this.countryCode);
  }

  get inSepaZone(): boolean {
    return this.spec.in_sepa_zone;
  }

  get countryCode(): string {
    return this._getSlice(0, 2);
  }

  get checksumDigits(): string {
    return this._getSlice(2, 4);
  }

  get nationalChecksumDigits(): string {
    return this.bban.nationalChecksumDigits;
  }

  get bankCode(): string {
    return this.bban.bankCode;
  }

  get branchCode(): string {
    return this.bban.branchCode;
  }

  get accountCode(): string {
    return this.bban.accountCode;
  }

  get accountId(): string {
    return this.bban.accountId;
  }

  get accountType(): string {
    return this.bban.accountType;
  }

  get accountHolderId(): string {
    return this.bban.accountHolderId;
  }

  get currencyCode(): string {
    return this.bban.currencyCode;
  }

  get bank(): BankEntry | null {
    return this.bban.bank;
  }

  get bankName(): string | null {
    return this.bban.bankName;
  }

  get bankShortName(): string | null {
    return this.bban.bankShortName;
  }

  endsWith(suffix: string): boolean {
    return this._value.endsWith(suffix);
  }
}

// Transform IBAN registry: add compiled regexes
function addBbanRegex(_country: string, spec: IbanSpec): IbanSpec {
  if (!spec.regex) {
    spec.regex = new RegExp(convertBbanSpecToRegex(spec.bban_spec));
  }
  return spec;
}

export function convertBbanSpecToRegex(spec: string): string {
  const specRe = new RegExp(
    `(\\d+)(!)?([${Object.keys(_specToRe).join("")}])`,
    "g"
  );
  const converted = spec.replace(specRe, (_match, count, fixed, type) => {
    const quantifier = fixed ? `{${count}}` : `{1,${count}}`;
    return _specToRe[type] + quantifier;
  });
  return `^${converted}$`;
}

registry.manipulate("iban", addBbanRegex);
