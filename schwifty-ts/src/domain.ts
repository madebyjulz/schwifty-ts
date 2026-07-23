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
