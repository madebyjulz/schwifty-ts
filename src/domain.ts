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
  /** The format is only reserved and not yet part of the official IBAN registry. */
  aspirational: boolean;
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

/**
 * The status of a bank code in the registry.
 *
 * - `ACTIVE`: the bank code is listed by the official source.
 * - `MERGED`: the bank was taken over or the code was replaced, so the code
 *   still leads to a successor.
 * - `CLOSED`: the bank was closed and has no successor.
 * - `DELISTED`: the bank code is no longer listed by the official source, which
 *   doesn't say why.
 */
export const BankStatus = {
  ACTIVE: "active",
  MERGED: "merged",
  CLOSED: "closed",
  DELISTED: "delisted",
} as const;

export type BankStatus = (typeof BankStatus)[keyof typeof BankStatus];

/**
 * A bank record of the registry.
 *
 * A retired bank code is no longer listed by the national registry, but kept so
 * that IBANs carrying it can still be identified. `status` tells what became of
 * it. If the bank was merged, `successor_bank_code` names the bank code of its
 * successor, where it is known, and `name` and `bic` describe the bank that
 * services the code today, while `legacy_name` and `legacy_bic` hold the merged
 * bank's own name and BIC.
 */
export interface Bank {
  bank_code: string;
  /** `null` for banks without a BIC, e.g. some Swiss institutes. */
  bic: string | null;
  /** Selects the national checksum method, e.g. the German `"13"`. */
  checksum_algo: string;
  country_code: string;
  legacy_bic: string | null;
  legacy_name: string | null;
  name: string;
  primary: boolean;
  short_name: string | null;
  status: BankStatus;
  successor_bank_code: string | null;
}

const _STATUS_RANK: Record<BankStatus, number> = {
  [BankStatus.ACTIVE]: 2,
  // Merged codes still lead to a successor, so they rank above closed and delisted ones.
  [BankStatus.MERGED]: 1,
  [BankStatus.CLOSED]: 0,
  [BankStatus.DELISTED]: 0,
};

const _INSTITUTION_BIC_LENGTH = 8;

/** Return the canonical form of `bic`, see `BIC.canonical`. */
export function canonicalBic(bic: string): string {
  const branchCode = bic.slice(_INSTITUTION_BIC_LENGTH);
  return branchCode === "" || branchCode === "XXX" ? bic.slice(0, _INSTITUTION_BIC_LENGTH) : bic;
}

/**
 * Rank the records of a bank code for lookups, the best one being the highest.
 *
 * All lookups by bank code (`IBAN.bank`, `IBAN.bic`, `BIC.fromBankCode` and the
 * order of `BIC.candidatesFromBankCode`) pick the highest ranked record, so that
 * they always describe the same institution. Records are ranked by
 *
 * 1. their status, so that an active branch is preferred over a retired head office,
 * 2. whether they have a BIC at all,
 * 3. whether their BIC is the one of the institution's primary office, i.e. has
 *    no branch code or the branch code "XXX", which ISO 9362 treats as identical,
 * 4. `primary`, and
 * 5. the canonical form of their BIC, as a stable tie-break.
 */
export function lookupRank(bank: Bank): [number, boolean, boolean, boolean, string] {
  const bic = bank.bic ? canonicalBic(bank.bic) : "";
  return [_STATUS_RANK[bank.status], Boolean(bic), bic.length === _INSTITUTION_BIC_LENGTH, bank.primary, bic];
}

/**
 * Compare two records by `lookupRank`.
 *
 * Deviation: Python orders the tuples `lookup_rank` returns natively, while
 * JavaScript needs the comparison spelled out.
 */
export function compareLookupRank(left: Bank, right: Bank): number {
  const [leftStatus, leftHasBic, leftIsOffice, leftPrimary, leftBic] = lookupRank(left);
  const [rightStatus, rightHasBic, rightIsOffice, rightPrimary, rightBic] = lookupRank(right);
  const rank =
    leftStatus - rightStatus ||
    Number(leftHasBic) - Number(rightHasBic) ||
    Number(leftIsOffice) - Number(rightIsOffice) ||
    Number(leftPrimary) - Number(rightPrimary);
  if (rank !== 0 || leftBic === rightBic) {
    return rank;
  }
  return leftBic < rightBic ? -1 : 1;
}

/**
 * Whether the position of at least one BBAN component is known.
 *
 * Upstream's `IBANSpec.has_positions` property; a function here because
 * `IBANSpec` is a plain interface over the parsed registry data.
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
