import bankData from "./data/bank.json";
import ibanData from "./data/iban.json";
import type { BankEntry, IbanSpec } from "./types.ts";

/**
 * What each registry key holds.
 *
 * `bank` and `iban` ship with the package as JSON; the rest are indexes over
 * `bank` that `buildIndex` materialises when `bic.ts`/`bban.ts` are imported.
 */
export interface Registries {
  bank: BankEntry[];
  bank_code: Record<string, BankEntry[]>;
  bic: Record<string, BankEntry[]>;
  country: Record<string, BankEntry[]>;
  iban: Record<string, IbanSpec>;
}

/** Registries keyed by an arbitrary string rather than holding a flat list. */
type MappingRegistry = Exclude<keyof Registries, "bank">;

const _registry = new Map<string, unknown>([
  ["bank", bankData],
  ["iban", ibanData],
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function mergeDicts(left: Record<string, unknown>, right: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};
  for (const key of Object.keys(right)) {
    if (key in left) {
      const lv = left[key];
      const rv = right[key];
      merged[key] = isPlainObject(lv) && isPlainObject(rv) ? mergeDicts(lv, rv) : rv;
    }
  }
  for (const key of Object.keys(left)) {
    if (!(key in merged)) {
      merged[key] = left[key];
    }
  }
  for (const key of Object.keys(right)) {
    if (!(key in merged)) {
      merged[key] = right[key];
    }
  }
  return merged;
}

export function has(name: string): boolean {
  return _registry.has(name);
}

export function get<K extends keyof Registries>(name: K): Registries[K] {
  const data = _registry.get(name);
  if (data === undefined) {
    throw new Error(`Unknown registry '${name}'`);
  }
  // The store is keyed by string at runtime (mirroring `schwifty.registry` in
  // the Python package) and the bundled JSON widens to plain array/object
  // types, so `Registries` is the hand-maintained contract for what lives
  // under each key. This is the single place that contract gets applied.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return data as Registries[K];
}

export function save<K extends keyof Registries>(name: K, data: Registries[K]): void {
  _registry.set(name, data);
}

/**
 * Group the bundled bank entries into `indexName`, keyed by one or more of
 * their fields. Entries with a blank value for any part of the key are
 * skipped, since they could not be looked up unambiguously anyway.
 */
export function buildIndex(indexName: MappingRegistry, key: keyof BankEntry | (keyof BankEntry)[]): void {
  const keyFields = Array.isArray(key) ? key : [key];
  const data: Record<string, BankEntry[]> = {};

  for (const entry of get("bank")) {
    const parts = keyFields.map((field) => String(entry[field] ?? ""));
    if (parts.some((part) => !part)) {
      continue;
    }
    const indexKey = parts.join("\0");
    data[indexKey] ??= [];
    data[indexKey].push(entry);
  }

  save(indexName, data);
}

/**
 * Rewrite every entry of the IBAN registry in place — used once at import time
 * to attach the compiled BBAN regex to each country spec. Add an overload here
 * if another registry ever needs the same treatment.
 */
export function manipulate(name: "iban", func: (key: string, value: IbanSpec) => IbanSpec): void {
  const reg = get(name);
  for (const key of Object.keys(reg)) {
    reg[key] = func(key, reg[key]);
  }
  save(name, reg);
}
