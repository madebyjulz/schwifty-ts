import { Base } from "./common.ts";
import { getCountry } from "./countries.ts";
import * as exceptions from "./exceptions.ts";
import * as registry from "./registry.ts";

const _bicIso9362Re = /^[A-Z0-9]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/u;
const _bicSwiftRe = /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}(?:[A-Z0-9]{3})?$/u;
const _INSTITUTION_LENGTH = 8;

/** The lexicographically greatest BIC, matching Python's `max()` over `str` subclasses. */
function maxBic(candidates: BIC[]): BIC {
  let [best] = candidates;
  for (const candidate of candidates) {
    if (candidate.lessThan(best)) {
      continue;
    }
    best = candidate;
  }
  return best;
}

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
    const sortedBanks = banks.toSorted((a, b) => Number(b.primary) - Number(a.primary));
    return sortedBanks.filter((entry) => entry.bic).map((entry) => new BIC(entry.bic));
  }

  static fromBankCode(countryCode: string, bankCode: string): BIC {
    const candidates = BIC.candidatesFromBankCode(countryCode, bankCode);
    if (candidates.length > 1) {
      // If we have multiple candidates, we try to pick the one with no branch
      // code which is the most generic one.
      const genericCodes = candidates.filter((c) => !c.branchCode);
      if (genericCodes.length > 0) {
        return maxBic(genericCodes);
      }
      // If we don't have one, we try to pick the one with 'XXX' as a branch code.
      const xxxCodes = candidates.filter((c) => c.branchCode === "XXX");
      if (xxxCodes.length > 0) {
        return maxBic(xxxCodes);
      }
    }
    // Every registry entry for this bank code may lack a BIC, in which case
    // there is no candidate to return (Python raises via IndexError here).
    const [first] = candidates;
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
    if (this.country === undefined) {
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

  private _lookupValues(key: "bank_code" | "name" | "short_name"): string[] {
    let entries = registry.getBanksByBic(this._value);
    if (entries.length === 0 && this.branchCode) {
      // An 11-character BIC denotes a branch of the institution that the
      // first 8 characters identify. Not every national registry lists
      // entries per branch, so fall back to the institution's BIC when
      // the branch-specific lookup comes up empty.
      entries = registry.getBanksByBic(this._value.slice(0, _INSTITUTION_LENGTH));
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

  get exists(): boolean {
    return registry.getBanksByBic(this._value).length > 0;
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
}
