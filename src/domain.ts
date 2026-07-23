/**
 * The addressable parts of a BBAN.
 *
 * Modelled as a const object rather than a TypeScript `enum` so the module
 * stays erasable (see `erasableSyntaxOnly` in tsconfig.json) while keeping
 * `Component.BANK_CODE` and `Object.values(Component)` working as before.
 */
export const Component = {
  ACCOUNT_ID: "account_id",
  ACCOUNT_TYPE: "account_type",
  ACCOUNT_CODE: "account_code",
  ACCOUNT_HOLDER_ID: "account_holder_id",
  CURRENCY_CODE: "currency_code",
  BANK_CODE: "bank_code",
  BRANCH_CODE: "branch_code",
  NATIONAL_CHECKSUM_DIGITS: "national_checksum_digits",
} as const;

export type Component = (typeof Component)[keyof typeof Component];

/** Half-open `[start, end)` slice of a BBAN occupied by one component. */
export class Range {
  readonly start: number;
  readonly end: number;

  constructor(start = 0, end = 0) {
    this.start = start;
    this.end = end;
  }

  get length(): number {
    return this.end - this.start;
  }

  /** A component the country's BBAN layout does not define at all. */
  get isEmpty(): boolean {
    return this.start === 0 && this.end === 0;
  }

  cut(s: string): string {
    return s.slice(this.start, this.end);
  }
}

/**
 * Build a fully populated record by evaluating `make` for every component.
 *
 * Spelled out key by key rather than assembled from `Object.fromEntries` so
 * that the result is `Record<Component, T>` by construction — no cast, and a
 * newly added component becomes a compile error here.
 */
export function componentRecord<T>(make: (component: Component) => T): Record<Component, T> {
  return {
    [Component.ACCOUNT_ID]: make(Component.ACCOUNT_ID),
    [Component.ACCOUNT_TYPE]: make(Component.ACCOUNT_TYPE),
    [Component.ACCOUNT_CODE]: make(Component.ACCOUNT_CODE),
    [Component.ACCOUNT_HOLDER_ID]: make(Component.ACCOUNT_HOLDER_ID),
    [Component.CURRENCY_CODE]: make(Component.CURRENCY_CODE),
    [Component.BANK_CODE]: make(Component.BANK_CODE),
    [Component.BRANCH_CODE]: make(Component.BRANCH_CODE),
    [Component.NATIONAL_CHECKSUM_DIGITS]: make(Component.NATIONAL_CHECKSUM_DIGITS),
  };
}

export function componentEntries<T>(record: Record<Component, T>): [Component, T][] {
  return Object.values(Component).map((component) => [component, record[component]]);
}

/** The country specific IBAN/BBAN specification, as parsed from the registry. */
export interface IBANSpec {
  bban_length: number;
  bban_spec: string;
  /** Components whose concatenation keys the bank lookup. Never empty. */
  bic_lookup_components: Component[];
  country: string;
  /** Registry-level fallbacks keyed by their raw `default_*` name. */
  defaults: Record<string, string>;
  iban_length: number;
  iban_spec: string;
  in_sepa_zone: boolean;
  /** Populated for every component; undefined layouts collapse to an empty `Range`. */
  positions: Record<Component, Range>;
  regex: RegExp;
}

/** A bank as listed in the registry. */
export interface Bank {
  bank_code: string;
  bic: string;
  /** Selects the national checksum method, e.g. the German `"13"`. */
  checksum_algo: string;
  country_code: string;
  name: string;
  primary: boolean;
  short_name: string | null;
}

/**
 * Whether the country declares a positional BBAN layout.
 *
 * `IBANSpec.positions` always holds an entry per component, so its mere
 * presence says nothing; a country the registry has no layout for (Angola,
 * Iran, ...) collapses to eight empty ranges and its BBANs have to be
 * generated straight from the regex instead of assembled component by
 * component.
 */
export function hasPositions(spec: IBANSpec): boolean {
  return Object.values(spec.positions).some((range) => !range.isEmpty);
}
