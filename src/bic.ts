import { Base } from "./common.ts";
import { getCountry } from "./countries.ts";
import type { Bank } from "./domain.ts";
import { canonicalBic, compareLookupRank } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";

const _bicIso9362Re = /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/u;
const _bicSwiftRe = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/u;
const _INSTITUTION_LENGTH = 8;

// Country codes SWIFT uses in BICs that are not (yet) part of ISO 3166-1. Kosovo's banks are
// assigned the user-assigned code XK, which the IBAN registry uses as well.
const _nonIsoCountryCodes = new Set(["XK"]);

export class BIC extends Base {
  constructor(bic: string, options?: { allowInvalid?: boolean; enforceSwiftCompliance?: boolean }) {
    super(bic);
    if (!options?.allowInvalid) {
      this.validate(options?.enforceSwiftCompliance ?? false);
    }
  }

  static candidatesFromBankCode(countryCode: string, bankCode: string): BIC[] {
    const banks = registry.getBanksByCode(countryCode, bankCode);
    if (banks.length === 0) {
      throw new exceptions.InvalidBankCode(`Unknown bank code '${bankCode}' for country '${countryCode}'`);
    }
    const sortedBanks = banks.toSorted((a, b) => compareLookupRank(b, a));
    // Bank records carry the canonical form of their BIC, so equivalent forms of the same BIC,
    // such as BNPAFRPP and BNPAFRPPXXX, are listed once.
    const bics = new Set(sortedBanks.flatMap((entry) => (entry.bic ? [entry.bic] : [])));
    return [...bics].map((bic) => new BIC(bic));
  }

  static fromBankCode(countryCode: string, bankCode: string): BIC {
    // The candidates are ordered by rank, the same way `IBAN.bank` picks its record, so that the
    // BIC and the bank describe the same institution. Every registry entry for this bank code
    // may lack a BIC, in which case there is no candidate to return (Python raises via
    // IndexError here).
    const [first] = BIC.candidatesFromBankCode(countryCode, bankCode);
    if (first === undefined) {
      throw new exceptions.InvalidBankCode(`Unknown bank code '${bankCode}' for country '${countryCode}'`);
    }
    return first;
  }

  validate(enforceSwiftCompliance = false): boolean {
    this._validateLength();
    this._validateStructure(enforceSwiftCompliance);
    this._validateCountryCode();
    return true;
  }

  private _validateLength(): void {
    if (this.length !== 8 && this.length !== 11) {
      throw new exceptions.InvalidLength(`Invalid length '${this.length}'`);
    }
  }

  private _validateStructure(enforceSwiftCompliance: boolean): void {
    const regex = enforceSwiftCompliance ? _bicSwiftRe : _bicIso9362Re;
    if (!regex.test(this._value)) {
      throw new exceptions.InvalidStructure(`Invalid structure '${this._value}'`);
    }
  }

  private _validateCountryCode(): void {
    if (this.country === undefined && !_nonIsoCountryCodes.has(this.countryCode)) {
      throw new exceptions.InvalidCountryCode(`Invalid country code '${this.countryCode}'`);
    }
  }

  get isValid(): boolean {
    try {
      return this.validate();
    } catch {
      return false;
    }
  }

  get formatted(): string {
    let formatted = `${this.bankCode} ${this.countryCode} ${this.locationCode}`;
    if (this.branchCode) {
      formatted += ` ${this.branchCode}`;
    }
    return formatted;
  }

  /**
   * The bank records of this BIC in the registry.
   *
   * A BIC without branch code and the same BIC with the branch code `XXX` are
   * treated as identical (see `canonical`). A branch BIC only has records if the
   * registry lists the branch itself.
   */
  get banks(): Bank[] {
    return registry.getBanksByBic(this._value);
  }

  private _lookupValues(key: "bank_code" | "name" | "short_name"): string[] {
    let entries = this.banks;
    if (entries.length === 0 && this.branchCode) {
      // An 11-character BIC denotes a branch of the institution that the
      // first 8 characters identify. Not every national registry lists
      // entries per branch, so fall back to the institution's BIC when
      // the branch-specific lookup comes up empty.
      entries = new BIC(this._value.slice(0, _INSTITUTION_LENGTH), { allowInvalid: true }).banks;
    }
    const values = new Set<string>();
    for (const entry of entries) {
      const value = entry[key];
      if (value) {
        values.add(value);
      }
    }
    return [...values].toSorted();
  }

  get domesticBankCodes(): string[] {
    return this._lookupValues("bank_code");
  }

  get bankNames(): string[] {
    return this._lookupValues("name");
  }

  get bankShortNames(): string[] {
    return this._lookupValues("short_name");
  }

  /**
   * Whether the BIC is available in the registry.
   *
   * A BIC without branch code and the same BIC with the branch code `XXX` are
   * treated as identical (see `canonical`). The former BIC of a merged bank
   * exists as well, see `Bank.legacy_bic`.
   */
  get exists(): boolean {
    return this.banks.length > 0;
  }

  get type(): string {
    const [, loc1] = this.locationCode;
    if (loc1 === "0") {
      return "testing";
    }
    if (loc1 === "1") {
      return "passive";
    }
    if (loc1 === "2") {
      return "reverse billing";
    }
    return "default";
  }

  get country(): string | undefined {
    return getCountry(this.countryCode);
  }

  get bankCode(): string {
    return this._getSlice(0, 4);
  }

  get countryCode(): string {
    return this._getSlice(4, 6);
  }

  get locationCode(): string {
    return this._getSlice(6, 8);
  }

  get branchCode(): string {
    return this._getSlice(8, 11);
  }

  /**
   * The BIC in the canonical form of its primary office.
   *
   * ISO 9362 treats a BIC without branch code and the same BIC with the branch
   * code `XXX` as identical. Both are returned in their 8-character form, other
   * branch codes are kept, so that two BICs denote the same office if their
   * canonical forms are equal.
   */
  get canonical(): BIC {
    const canonical = canonicalBic(this._value);
    return canonical === this._value ? this : new BIC(canonical, { allowInvalid: true });
  }
}
