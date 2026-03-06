import type { Component } from "./domain.ts";

export interface BankEntry {
  bank_code: string;
  bic: string;
  checksum_algo?: string;
  country_code: string;
  name: string;
  primary: boolean;
  short_name: string;
}

export interface IbanSpec {
  bban_length: number;
  bban_spec: string;
  bic_lookup_components?: Component[];
  country: string;
  default_currency_code?: string;
  iban_length: number;
  iban_spec: string;
  in_sepa_zone: boolean;
  positions?: Record<string, [number, number]>;
  regex?: RegExp;
}
