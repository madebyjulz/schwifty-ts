import { BBAN } from "./bban.ts";
import type { BIC } from "./bic.ts";
import { ISO7064Mod97_10, numerify } from "./checksum/index.ts";
import { Base } from "./common.ts";
import { getCountry } from "./countries.ts";
import type { Bank, IBANSpec } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";

const _IBAN_STRUCTURE_RE = /^[A-Z]{2}\d{2}[A-Z0-9]+$/u;
const _iso7064Mod97_10 = new ISO7064Mod97_10();

export class IBAN extends Base {
  readonly bban: BBAN;

  constructor(iban: string, options?: { allowInvalid?: boolean; validateBban?: boolean }) {
    super(iban);
    this.bban = new BBAN(this.countryCode, this._getSlice(4));
    if (!options?.allowInvalid) {
      this.validate(options?.validateBban ?? false);
    }
  }

  static fromBban(
    countryCode: string,
    bban: string | BBAN,
    options?: { allowInvalid?: boolean; validateBban?: boolean },
  ): IBAN {
    const bbanStr = typeof bban === "string" ? bban : bban.compact;
    const checkDigits = _iso7064Mod97_10.compute([bbanStr, countryCode]);
    return new IBAN(countryCode + checkDigits + bbanStr, options);
  }

  static generate(
    countryCode: string,
    bankCode: string,
    accountCode: string,
    branchCode = "",
    extra?: Record<string, string>,
  ): IBAN {
    return IBAN.fromBban(
      countryCode,
      BBAN.fromComponents(countryCode, {
        bank_code: bankCode,
        branch_code: branchCode,
        account_code: accountCode,
        ...extra,
      }),
    );
  }

  static random(countryCode = "", options?: { useRegistry?: boolean; values?: Record<string, string> }): IBAN {
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
    // Anchored at both ends over the alphanumeric BBAN: matching only the
    // country/check-digit prefix (and excluding digits from the BBAN) used to
    // let invalid characters further along the string slip through.
    if (!_IBAN_STRUCTURE_RE.test(this._value)) {
      throw new exceptions.InvalidStructure(`Invalid characters in IBAN ${this._value}`);
    }
  }

  private _validateLength(): void {
    if (this.spec.iban_length !== this.length) {
      throw new exceptions.InvalidLength("Invalid IBAN length");
    }
  }

  private _validateFormat(): void {
    const { regex } = this.spec;
    if (!regex.test(this.bban.compact)) {
      throw new exceptions.InvalidStructure(
        `Invalid BBAN structure: '${this.bban.toString()}' doesn't match '${this.spec.bban_spec}'`,
      );
    }
  }

  private _validateIbanChecksum(): void {
    // Validating against the canonically computed check digits is stricter than a bare
    // `numeric % 97 === 1` test: the ISO 7064 mod-97-10 algorithm only ever yields check
    // digits in the range 02..98, whereas the raw mod-97 test additionally accepts the
    // aliases 00, 01 and 99 (which no genuine IBAN carries). A passing `validate` always
    // implies `numeric % 97 === 1`, so the latter check is redundant.
    if (!_iso7064Mod97_10.validate([this.bban.compact, this.countryCode], this.checksumDigits)) {
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

  get spec(): IBANSpec {
    return registry.getIbanSpec(this.countryCode);
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

  get bank(): Bank | null {
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
