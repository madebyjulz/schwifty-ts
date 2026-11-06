/**
 * Shapes of the bundled registry JSON, i.e. the *input* to deserialization.
 *
 * The parsed, strongly typed counterparts that the rest of the library works
 * with — `Bank` and `IBANSpec` — live in `domain.ts`. Fields the registry only
 * carries for some countries are optional here and get defaulted during
 * parsing.
 */

import type { BankStatus } from "./domain.ts";

/**
 * One bank as stored in the generated `data/bank.ts`, as a positional tuple:
 * `[country_code, bank_code, bic, name, short_name, primary, checksum_algo,
 * status, successor_bank_code, legacy_name, legacy_bic]`.
 * `primary` is `1`/`0`. The fields from `checksum_algo` on are optional: `""`
 * stands for the default, and trailing defaults are omitted.
 * Keep in sync with `BANK_ROW_FIELDS` in `scripts/consolidate-registry.ts`.
 */
export type BankRow = [
  countryCode: string,
  bankCode: string,
  bic: string | null,
  name: string,
  shortName: string | null,
  primary: 0 | 1,
  checksumAlgo?: string,
  status?: BankStatus | "",
  successorBankCode?: string,
  legacyName?: string,
  legacyBic?: string,
];

export interface RawIbanSpec {
  aspirational?: boolean;
  bban_length: number;
  bban_spec: string;
  bic_lookup_components?: string[];
  /** Not every entry repeats it; the registry key is the authority. */
  country?: string;
  default_currency_code?: string;
  iban_length: number;
  iban_spec: string;
  in_sepa_zone?: boolean;
  /**
   * Component name to its `[start, end]` offsets. Typed as a plain `number[]`
   * because that is what the bundled JSON infers to; the pair is validated when
   * it is turned into a `Range`.
   */
  positions?: Record<string, number[]>;
}
