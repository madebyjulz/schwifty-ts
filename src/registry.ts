import bankData from "./data/bank.json";
import ibanData from "./data/iban.json";
import type { Bank, IBANSpec } from "./domain.ts";
import { Component, componentRecord, Range } from "./domain.ts";
import * as exceptions from "./exceptions.ts";
import type { RawBank, RawIbanSpec } from "./types.ts";

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

// The bundled JSON widens to plain array/object types on import, so these two
// assertions are where the hand-maintained contract about the file layout gets
// applied. Everything downstream works off the parsed domain objects instead.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const _rawBanks = bankData as RawBank[];
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

function parseBank(data: RawBank): Bank {
  return {
    country_code: data.country_code ?? "",
    bic: data.bic ?? "",
    bank_code: data.bank_code ?? "",
    name: data.name ?? "",
    short_name: data.short_name ?? null,
    primary: data.primary ?? false,
    checksum_algo: data.checksum_algo ?? "default",
  };
}

const _ibanSpecs = new Map<string, IBANSpec>();
let _banks: Bank[] | null = null;
let _byCountry: Map<string, Bank[]> | null = null;
let _byBankCode: Map<string, Bank[]> | null = null;
let _byBic: Map<string, Bank[]> | null = null;

/**
 * Compound key for the `(country_code, bank_code)` index.
 *
 * NUL separates the parts so that no pair of codes can collide, whatever
 * characters a national bank code turns out to use.
 */
function bankCodeKey(countryCode: string, bankCode: string): string {
  return `${countryCode}\u0000${bankCode}`;
}

function allBanks(): Bank[] {
  _banks ??= _rawBanks.map(parseBank);
  return _banks;
}

/**
 * Group the banks into an index keyed by `keyOf`. Entries the key is blank for
 * are skipped, since they could not be looked up unambiguously anyway.
 */
function buildIndex(keyOf: (bank: Bank) => string): Map<string, Bank[]> {
  const index = new Map<string, Bank[]>();
  for (const bank of allBanks()) {
    const key = keyOf(bank);
    if (!key) {
      continue;
    }
    const bucket = index.get(key);
    if (bucket === undefined) {
      index.set(key, [bank]);
    } else {
      bucket.push(bank);
    }
  }
  return index;
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
  _byCountry ??= buildIndex((bank) => bank.country_code);
  return _byCountry.get(countryCode) ?? [];
}

export function getBanksByCode(countryCode: string, bankCode: string): Bank[] {
  _byBankCode ??= buildIndex((bank) =>
    bank.country_code && bank.bank_code ? bankCodeKey(bank.country_code, bank.bank_code) : "",
  );
  return _byBankCode.get(bankCodeKey(countryCode, bankCode)) ?? [];
}

export function getBanksByBic(bic: string): Bank[] {
  _byBic ??= buildIndex((bank) => bank.bic);
  return _byBic.get(bic) ?? [];
}

export function getCountries(): string[] {
  _byCountry ??= buildIndex((bank) => bank.country_code);
  return [..._byCountry.keys()];
}

export function getAllBanks(): Bank[] {
  return allBanks();
}
