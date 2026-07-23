/**
 * Shapes of the bundled registry JSON, i.e. the *input* to deserialization.
 *
 * The parsed, strongly typed counterparts that the rest of the library works
 * with — `Bank` and `IBANSpec` — live in `domain.ts`. Fields the registry only
 * carries for some countries are optional here and get defaulted during
 * parsing.
 */

export interface RawBank {
  bank_code?: string;
  bic?: string;
  checksum_algo?: string;
  country_code?: string;
  name?: string;
  primary?: boolean;
  short_name?: string | null;
}

export interface RawIbanSpec {
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
