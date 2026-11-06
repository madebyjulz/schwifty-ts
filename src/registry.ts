import bankRows from "./data/bank.ts";
import ibanData from "./data/iban.json";
import type { Bank, IBANSpec } from "./domain.ts";
import { BankStatus, canonicalBic, Component, componentRecord, Range } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import type { BankRow, RawIbanSpec } from "./types.ts";

const BIC_COUNTRY_START = 4;
const BIC_COUNTRY_END = 6;

const _specToRe: Record<string, string> = {
  n: "\\d",
  a: "[A-Z]",
  c: "[A-Za-z0-9]",
  e: " ",
};

/** Translate a SWIFT BBAN specification such as `8!n10!n` into a regex source. */
export function convertBbanSpecToRegex(spec: string): string {
  const specRe = new RegExp(`(\\d+)(!)?([${Object.keys(_specToRe).join("")}])`, "gu");
  const converted = spec.replace(specRe, (_match: string, count: string, fixed: string | undefined, type: string) => {
    const quantifier = fixed ? `{${count}}` : `{1,${count}}`;
    return _specToRe[type] + quantifier;
  });
  return `^${converted}$`;
}

// The bundled JSON widens to a plain object type on import, so this assertion
// is where the hand-maintained contract about the file layout gets applied.
// Everything downstream works off the parsed domain objects instead.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const _rawIbanSpecs = ibanData as Record<string, RawIbanSpec>;

const _componentValues = new Set<string>(Object.values(Component));

function isComponent(value: string): value is Component {
  return _componentValues.has(value);
}

function parseIbanSpec(countryCode: string, data: RawIbanSpec): IBANSpec {
  const rawPositions = data.positions ?? {};
  const positions = componentRecord((component) => {
    const coords = rawPositions[component];
    if (coords === undefined || coords.length < 2) {
      return new Range();
    }
    return new Range(coords[0], coords[1]);
  });

  const bicLookupComponents = (data.bic_lookup_components ?? [Component.BANK_CODE]).filter(isComponent);

  const defaults: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key.startsWith("default_") && (typeof value === "string" || typeof value === "number")) {
      defaults[key] = String(value);
    }
  }

  return {
    aspirational: data.aspirational ?? false,
    country: countryCode,
    bban_spec: data.bban_spec,
    bban_length: data.bban_length,
    iban_spec: data.iban_spec,
    iban_length: data.iban_length,
    in_sepa_zone: data.in_sepa_zone ?? false,
    regex: new RegExp(convertBbanSpecToRegex(data.bban_spec), "u"),
    positions,
    bic_lookup_components: bicLookupComponents,
    defaults,
  };
}

export function parseBank(row: BankRow): Bank {
  const [
    country_code,
    bank_code,
    bic,
    name,
    short_name,
    primary,
    checksum_algo,
    status,
    successor_bank_code,
    legacy_name,
    legacy_bic,
  ] = row;
  return {
    country_code,
    // Registries store the BIC of a primary office with or without the branch code "XXX",
    // which ISO 9362 treats as identical. Banks carry the canonical 8-character form.
    bic: bic ? canonicalBic(bic) : bic,
    bank_code,
    name,
    short_name,
    primary: primary === 1,
    checksum_algo: checksum_algo || "default",
    status: status || BankStatus.ACTIVE,
    successor_bank_code: successor_bank_code || null,
    legacy_name: legacy_name || null,
    legacy_bic: legacy_bic ? canonicalBic(legacy_bic) : null,
  };
}

/** The bank records of one country and its lookup indexes, which share the same `Bank` objects. */
interface CountryBanks {
  banks: Bank[];
  byBankCode: Map<string, Bank[]>;
  byBic: Map<string, Bank[]>;
}

function addToIndex(index: Map<string, Bank[]>, key: string, bank: Bank): void {
  const bucket = index.get(key);
  if (bucket === undefined) {
    index.set(key, [bank]);
  } else {
    bucket.push(bank);
  }
}

const _ibanSpecs = new Map<string, IBANSpec>();
const _banks = new Map<string, CountryBanks>();
let _bankRowIndex: Map<string, BankRow[]> | null = null;

/**
 * The rows of every country.
 *
 * Deviation: upstream's `_bank_files` maps a country to its registry files and
 * reads them on first use. The registry is bundled here, so there are no files
 * to defer and the country's rows take their place. Parsing still happens per
 * country in `_getCountryBanks`, which keeps the lookups structured like upstream.
 */
function _bankRows(): Map<string, BankRow[]> {
  if (_bankRowIndex === null) {
    _bankRowIndex = new Map();
    for (const row of bankRows) {
      const [countryCode] = row;
      const rows = _bankRowIndex.get(countryCode);
      if (rows === undefined) {
        _bankRowIndex.set(countryCode, [row]);
      } else {
        rows.push(row);
      }
    }
  }
  return _bankRowIndex;
}

function _getCountryBanks(countryCode: string): CountryBanks {
  const cached = _banks.get(countryCode);
  if (cached !== undefined) {
    return cached;
  }

  const banks: CountryBanks = { banks: [], byBankCode: new Map(), byBic: new Map() };
  for (const row of _bankRows().get(countryCode) ?? []) {
    const bank = parseBank(row);
    banks.banks.push(bank);
    if (bank.bank_code) {
      addToIndex(banks.byBankCode, bank.bank_code, bank);
    }
    if (bank.bic) {
      addToIndex(banks.byBic, bank.bic, bank);
    }
    if (bank.legacy_bic && bank.legacy_bic !== bank.bic) {
      // The BIC of a merged bank still resolves to its retired bank code.
      addToIndex(banks.byBic, bank.legacy_bic, bank);
    }
  }
  _banks.set(countryCode, banks);
  return banks;
}

/**
 * The country specific IBAN specification.
 *
 * @throws {InvalidCountryCode} If the registry has no entry for `countryCode`.
 */
export function getIbanSpec(countryCode: string): IBANSpec {
  const cached = _ibanSpecs.get(countryCode);
  if (cached !== undefined) {
    return cached;
  }
  const raw = _rawIbanSpecs[countryCode];
  if (raw === undefined) {
    throw new exceptions.InvalidCountryCode(`Unknown country-code '${countryCode}'`);
  }
  const spec = parseIbanSpec(countryCode, raw);
  _ibanSpecs.set(countryCode, spec);
  return spec;
}

export function getBanksByCountry(countryCode: string): Bank[] {
  return _getCountryBanks(countryCode).banks;
}

export function getBanksByCode(countryCode: string, bankCode: string): Bank[] {
  return _getCountryBanks(countryCode).byBankCode.get(bankCode) ?? [];
}

export function getBanksByBic(bic: string): Bank[] {
  // Only the registry of the BIC's own country is searched. Banks are indexed by the canonical
  // form of their BIC, so that e.g. REVOGB21 and REVOGB21XXX find the same banks.
  return (
    _getCountryBanks(bic.slice(BIC_COUNTRY_START, BIC_COUNTRY_END).toUpperCase()).byBic.get(canonicalBic(bic)) ?? []
  );
}

export function getCountries(): string[] {
  return [..._bankRows().keys()];
}

export function getAllBanks(): Bank[] {
  return getCountries().flatMap((countryCode) => getBanksByCountry(countryCode));
}
