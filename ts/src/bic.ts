import { Base } from "./common.ts";
import { getCountry } from "./countries.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";
import type { BankEntry } from "./types.ts";

const _bicIso9362Re = /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;
const _bicSwiftRe = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/;

export class BIC extends Base {
  constructor(
    bic: string,
    options?: { allowInvalid?: boolean; enforceSwiftCompliance?: boolean }
  ) {
    super(bic);
    if (!options?.allowInvalid) {
      this.validate(options?.enforceSwiftCompliance ?? false);
    }
  }

  static candidatesFromBankCode(countryCode: string, bankCode: string): BIC[] {
    try {
      const index = registry.get<Record<string, BankEntry[]>>("bank_code");
      const key = `${countryCode}\0${bankCode}`;
      const entries = index[key];
      if (!entries) {
        throw new Error("not found");
      }
      const sorted = [...entries].sort(
        (a, b) => (b.primary ? 1 : 0) - (a.primary ? 1 : 0)
      );
      return sorted
        .filter((entry) => entry.bic)
        .map((entry) => new BIC(entry.bic));
    } catch {
      throw new exceptions.InvalidBankCode(
        `Unknown bank code '${bankCode}' for country '${countryCode}'`
      );
    }
  }

  static fromBankCode(countryCode: string, bankCode: string): BIC {
    try {
      const candidates = BIC.candidatesFromBankCode(countryCode, bankCode);
      if (candidates.length > 1) {
        const noBranch = candidates.filter((c) => !c.branchCode);
        if (noBranch.length > 0) {
          return noBranch.sort((a, b) => a.compact.localeCompare(b.compact))[
            noBranch.length - 1
          ];
        }
        const xxxBranch = candidates.filter((c) => c.branchCode === "XXX");
        if (xxxBranch.length > 0) {
          return xxxBranch.sort((a, b) => a.compact.localeCompare(b.compact))[
            xxxBranch.length - 1
          ];
        }
      }
      return candidates[0];
    } catch (e) {
      if (e instanceof exceptions.InvalidBankCode) {
        throw e;
      }
      throw new exceptions.InvalidBankCode(
        `Unknown bank code '${bankCode}' for country '${countryCode}'`
      );
    }
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
      throw new exceptions.InvalidStructure(
        `Invalid structure '${this._value}'`
      );
    }
  }

  private _validateCountryCode(): void {
    if (this.country === undefined) {
      throw new exceptions.InvalidCountryCode(
        `Invalid country code '${this.countryCode}'`
      );
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

  private _lookupValues(key: keyof BankEntry): string[] {
    const spec = registry.get<Record<string, BankEntry[]>>("bic");
    const entries = spec[this._value] || [];
    const values = new Set<string>();
    for (const entry of entries) {
      const val = entry[key];
      if (val) {
        values.add(String(val));
      }
    }
    return [...values].sort();
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

  get exists(): boolean {
    const spec = registry.get<Record<string, BankEntry[]>>("bic");
    return Boolean(spec[this._value]);
  }

  get type(): string {
    const loc1 = this.locationCode[1];
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
}

// Build indexes on first import
registry.buildIndex("bank", "bic", "bic", true);
registry.buildIndex("bank", "bank_code", ["country_code", "bank_code"], true);
