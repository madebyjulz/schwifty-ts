# schwifty-ts

A pure TypeScript port of [schwifty](https://github.com/mdomke/schwifty), the Python library for working with IBANs and BICs as specified by ISO 13616 and ISO 9362.

This is a **1:1 port** of the Python package. All IBAN/BIC validation logic, checksum algorithms and bank registry data are identical to the upstream Python version. Zero runtime dependencies.

## Features

`schwifty-ts` lets you

- validate check digits and the country specific format of IBANs
- validate the national (BBAN) checksum where a country defines one
- validate format and country codes of BICs
- generate BICs from country and bank code
- generate IBANs from country code, bank code and account number
- generate random valid IBANs
- get the BIC associated to an IBAN's bank code
- access all relevant components as properties
- plug `IBAN`/`BIC` validation into any [Standard Schema](https://standardschema.dev) consumer

## Installation

```bash
npm install schwifty-ts
```

Requires Node.js 22.6 or newer (or any modern bundler). The package is ESM only.

## Usage

```ts
import { BIC, IBAN } from "schwifty-ts";

// Validate an IBAN. The constructor throws a SchwiftyException subclass on
// invalid input; pass { allowInvalid: true } to defer to `isValid`/`validate()`.
const iban = new IBAN("DE89 3704 0044 0532 0130 00");
iban.compact; // "DE89370400440532013000"
iban.formatted; // "DE89 3704 0044 0532 0130 00"
iban.countryCode; // "DE"
iban.bankCode; // "37040044"
iban.accountCode; // "0532013000"
iban.bankName; // "Commerzbank"
iban.bic?.compact; // "COBADEFFXXX"
iban.inSepaZone; // true

// Also check the country specific national checksum.
new IBAN("DE89370400440532013000", { validateBban: true });

// Generate an IBAN from its components.
IBAN.generate("DE", "37040044", "0532013000").compact; // "DE89370400440532013000"

// Random, valid IBANs (optionally for a given country and with pinned components).
IBAN.random("ES").isValid; // true
IBAN.random("DE", { values: { bank_code: "37040044" } }).bankCode; // "37040044"

// Validate a BIC.
const bic = new BIC("MARKDEF1100");
bic.countryCode; // "DE"
bic.domesticBankCodes; // ["10000000"]

// Look up a BIC from a domestic bank code.
BIC.fromBankCode("DE", "37040044").compact; // "COBADEFFXXX"
```

### Errors

Every validation failure throws a subclass of `SchwiftyException`: `InvalidLength`, `InvalidStructure`, `InvalidCountryCode`, `InvalidBankCode`, `InvalidBranchCode`, `InvalidAccountCode`, `InvalidChecksumDigits`, `InvalidBBANChecksum` and `GenerateRandomOverflowError`.

### Standard Schema

`ibanSchema()` and `bicSchema()` return [Standard Schema](https://standardschema.dev) objects that parse a string into an `IBAN`/`BIC` instance. They work with every library that accepts the spec (Zod, Valibot, ArkType, tRPC, TanStack Form, ...). This is the TypeScript counterpart of the pydantic integration upstream ships.

```ts
import { ibanSchema } from "schwifty-ts";

const result = ibanSchema({ validateBban: true })["~standard"].validate(input);
if (result.issues) {
  console.error(result.issues[0].message);
} else {
  result.value.bankName;
}
```

### Registry access

The bank and IBAN registries are exposed through typed queries: `getIbanSpec`, `getBanksByCountry`, `getBanksByCode`, `getBanksByBic`, `getCountries` and `getAllBanks`.

## Versioning

Versions follow the upstream Python package, which uses [CalVer](https://calver.org/) with the scheme `YYYY.0M.Micro`. npm requires semver, so the scheme is mapped as

```
upstream 2026.07.3  ->  2026.7.300
```

The patch number is the upstream micro version times 100. TypeScript-only fixes increment it: `2026.7.301`, `2026.7.302`, ... This keeps every version comparable and ensures that the next upstream micro release (`2026.7.400`) sorts after all TypeScript-only fixes of the previous one.

The exact upstream revision a release was ported from is recorded in `package.json` under `schwifty.upstream`.

## Porting upstream changes

The Python source is vendored as the `schwifty-py` git submodule and is the source of truth for the registry data.

```bash
git submodule update --init   # once, after cloning
pnpm sync:upstream            # latest upstream tag
pnpm sync:upstream main       # tip of upstream main
```

The script fetches upstream, checks out the requested revision, prints the commits and source diff since the last ported revision, regenerates `src/data` and records the new revision in `package.json`. Porting the printed diff to `src/` and adding a changelog entry remains a manual step. A weekly GitHub Actions workflow opens an issue when upstream publishes a release that has not been ported yet.

To keep the port reviewable, files, classes and helpers mirror their Python counterparts one-to-one, including internal names (`_bank_lookup_key` becomes `_bankLookupKey`). Deviations that JavaScript demands are commented at the point of deviation and listed in the changelog.

## Issues

This package is a direct port of the Python library. Please file issues in the correct place:

- **TypeScript-specific bugs** (build, types, bundling, JS runtime issues): [schwifty-ts issues](https://github.com/madebyjulz/schwifty-ts/issues)
- **IBAN/BIC validation logic, bank registry data, checksum algorithms**: [schwifty (Python) issues](https://github.com/mdomke/schwifty/issues)

## Development

```bash
pnpm install
pnpm test        # vitest
pnpm check       # oxlint + oxfmt via ultracite
pnpm typecheck   # tsc
pnpm build       # tsdown, regenerates src/data first when the submodule is present
```

## License

`schwifty-ts` is released under the [MIT](https://choosealicense.com/licenses/mit/) license. The code is maintained on [GitHub](https://github.com/madebyjulz/schwifty-ts) and packages are distributed on [npm](https://www.npmjs.com/package/schwifty-ts).
