import bankData from "./data/bank.json";
import ibanData from "./data/iban.json";
import type { BankEntry, IbanSpec } from "./types.ts";

const _registry = new Map<string, unknown>();

// Pre-populate with bundled data
_registry.set("bank", bankData as BankEntry[]);
_registry.set("iban", ibanData as unknown as Record<string, IbanSpec>);

export function mergeDicts<T extends Record<string, unknown>>(
  left: T,
  right: T
): T {
  const merged = {} as T;
  for (const key of Object.keys(right)) {
    if (key in left) {
      const lv = left[key];
      const rv = right[key];
      if (
        typeof lv === "object" &&
        lv !== null &&
        !Array.isArray(lv) &&
        typeof rv === "object" &&
        rv !== null &&
        !Array.isArray(rv)
      ) {
        (merged as Record<string, unknown>)[key] = mergeDicts(
          lv as Record<string, unknown>,
          rv as Record<string, unknown>
        );
      } else {
        (merged as Record<string, unknown>)[key] = rv;
      }
    }
  }
  for (const key of Object.keys(left)) {
    if (!(key in merged)) {
      (merged as Record<string, unknown>)[key] = left[key];
    }
  }
  for (const key of Object.keys(right)) {
    if (!(key in merged)) {
      (merged as Record<string, unknown>)[key] = right[key];
    }
  }
  return merged;
}

export function has(name: string): boolean {
  return _registry.has(name);
}

export function get<T>(name: string): T {
  const data = _registry.get(name);
  if (!data) {
    throw new Error(`Unknown registry '${name}'`);
  }
  return data as T;
}

export function save(name: string, data: unknown): void {
  _registry.set(name, data);
}

export function buildIndex(
  baseName: string,
  indexName: string,
  key: string | [string, string],
  accumulate = false,
  predicate?: Record<string, unknown>
): void {
  function makeKey(entry: Record<string, unknown>): string {
    if (Array.isArray(key)) {
      return key.map((k) => String(entry[k] ?? "")).join("\0");
    }
    return String(entry[key] ?? "");
  }

  function match(entry: Record<string, unknown>): boolean {
    if (!predicate) {
      return true;
    }
    return Object.entries(predicate).every(([k, v]) => entry[k] === v);
  }

  const base = get<Record<string, unknown>[]>(baseName);
  if (!Array.isArray(base)) {
    throw new Error("Base must be a list");
  }

  if (accumulate) {
    const data: Record<string, Record<string, unknown>[]> = {};
    for (const entry of base) {
      if (!match(entry)) {
        continue;
      }
      const ik = makeKey(entry);
      if (!ik) {
        continue;
      }
      if (Array.isArray(key)) {
        const parts = ik.split("\0");
        if (parts.some((p) => !p)) {
          continue;
        }
      }
      if (!data[ik]) {
        data[ik] = [];
      }
      data[ik].push(entry);
    }
    save(indexName, data);
  } else {
    const data: Record<string, Record<string, unknown>> = {};
    for (const entry of base) {
      if (!match(entry)) {
        continue;
      }
      data[makeKey(entry)] = entry;
    }
    save(indexName, data);
  }
}

export function manipulate<V>(
  name: string,
  func: (key: string, value: V) => V
): void {
  const reg = get<Record<string, V>>(name);
  for (const key of Object.keys(reg)) {
    reg[key] = func(key, reg[key]);
  }
  save(name, reg);
}
