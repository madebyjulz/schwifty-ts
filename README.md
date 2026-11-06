# @madebyjulz/schwifty-ts

A pure TypeScript port of [schwifty](https://github.com/mdomke/schwifty), the Python library for working with IBANs and BICs as specified by ISO 13616 and ISO 9362.

This is a **1:1 port** of the Python package. All IBAN/BIC validation logic, checksum algorithms and bank registry data are identical to the upstream Python version. Zero runtime dependencies.

## Features

`@madebyjulz/schwifty-ts` lets you

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
pnpm add @madebyjulz/schwifty-ts
```

Requires Node.js 22.6 or newer (or any modern bundler). The package is ESM only. Any package manager works; pnpm is what the project itself uses.

## Usage

```ts
import { BIC, IBAN } from "@madebyjulz/schwifty-ts";

// Validate an IBAN. The constructor throws a SchwiftyException subclass on
// invalid input; pass { allowInvalid: true } to defer to `isValid`/`validate()`.
const iban = new IBAN("DE89 3704 0044 0532 0130 00");
iban.compact; // "DE89370400440532013000"
iban.formatted; // "DE89 3704 0044 0532 0130 00"
iban.countryCode; // "DE"
iban.bankCode; // "37040044"
iban.accountCode; // "0532013000"
iban.bankName; // "Commerzbank"
iban.bic?.compact; // "COBADEFF"
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
BIC.fromBankCode("DE", "37040044").compact; // "COBADEFF"
```

### Errors

Every validation failure throws a subclass of `SchwiftyException`: `InvalidLength`, `InvalidStructure`, `InvalidCountryCode`, `InvalidBankCode`, `InvalidBranchCode`, `InvalidAccountCode`, `InvalidChecksumDigits`, `InvalidBBANChecksum`, `NationalChecksumNotVerified` (only with `unverifiedChecksum: "error"`) and `GenerateRandomOverflowError`.

### Unverified national checksums

Some countries declare national check digits in their BBAN but have no algorithm registered to verify them (e.g. `HU`, `SE`). With `validateBban: true` their digits are accepted unchecked, since a missing algorithm must not reject an otherwise valid IBAN. `unverifiedChecksum` decides what happens instead, and `hasUnverifiableNationalChecksum` tells you whether it applies:

```ts
const iban = new IBAN("HU42 1177 3016 1111 1018 0000 0000", { validateBban: true });
iban.hasUnverifiableNationalChecksum; // true

new IBAN(value, { validateBban: true, unverifiedChecksum: "warn" }); // accept and report a warning
new IBAN(value, { validateBban: true, unverifiedChecksum: "error" }); // throw NationalChecksumNotVerified
ibanSchema({ validateBban: true, unverifiedChecksum: "error" }); // same option for the schema
```

`"warn"` reports through `process.emitWarning` (Node.js, Bun, Deno) or `console.warn` (browsers). The default is `"ignore"`. This differs from upstream; see [Deviations from upstream](#deviations-from-upstream).

### Retired bank codes

Banks merge or close, but IBANs with their bank codes stay in circulation, so the registry keeps retired bank codes. `Bank.status` tells what became of them: `merged`, `closed`, or `delisted` if the source doesn't say why it no longer lists the code. The code of a merged bank resolves to the bank that services it today, and its own name and BIC are kept:

```ts
const iban = IBAN.generate("DE", "13061088", "1234567");
iban.bank?.name; // "Volks- und Raiffeisenbank"
iban.bank?.status; // "merged"
iban.bank?.successor_bank_code; // "13061078"
iban.bank?.legacy_name; // "Raiffeisenbank Wismar"
iban.bank?.legacy_bic; // "GENODEF1HWR"
iban.bic?.compact; // "GENODEF1HWI"
new BIC("GENODEF1HWR").domesticBankCodes; // ["13061088"]
```

Closed and delisted banks are still returned, so that an IBAN can be identified. No payments can be made to them, so check `status` before you initiate one.

### Standard Schema

`ibanSchema()` and `bicSchema()` return [Standard Schema](https://standardschema.dev) objects that parse a string into an `IBAN`/`BIC` instance. They work with every library that accepts the spec (Zod, Valibot, ArkType, tRPC, TanStack Form, ...). This is the TypeScript counterpart of the pydantic integration upstream ships.

```ts
import { ibanSchema } from "@madebyjulz/schwifty-ts";

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

Releases use [CalVer](https://calver.org/) in semver-compatible form, `YYYY.M.Patch`, keyed to the month the **TypeScript package** is released: `2026.9.0` is the first release of September 2026, `2026.9.1` the second, and so on. Ports of upstream changes and TypeScript-only fixes both bump the patch number.

The version therefore does not encode the upstream version. The exact upstream revision (and tag, if any) a release was ported from is recorded in `package.json` under `schwifty.upstream` and named at the top of every changelog entry.

## Porting upstream changes

The Python source is vendored as the `schwifty-py` git submodule and is the source of truth for the registry data.

```bash
pnpm sync:upstream            # latest upstream tag
pnpm sync:upstream main       # tip of upstream main
pnpm parity                   # compare the build with the Python package
pnpm sync:upstream --record   # after porting: record the new revision
```

`pnpm sync:upstream` fetches upstream, checks out the requested revision, prints the commits and source diff since the last recorded revision (without registry data) and regenerates `src/data`. Regenerating fails when the registry gained a field the bundle does not cover yet. The recorded revision only moves with `--record`, so a rerun prints the same diff until the port is finished.

`pnpm parity` runs a generated corpus of IBANs, BICs and bank codes through both packages and reports every difference. It tests the build, not the source, and needs [uv](https://docs.astral.sh/uv/) and the submodule at the ported revision. It also runs before every publish (`prepublishOnly`), so a release with differences cannot go out.

In Claude Code, `/port-upstream` runs this whole workflow. A weekly GitHub Actions workflow opens an issue when upstream publishes a release that has not been ported yet.

To keep the port reviewable, files, classes and helpers mirror their Python counterparts one-to-one, including internal names (`_bank_lookup_key` becomes `_bankLookupKey`). Deviations that JavaScript demands are commented at the point of deviation and listed in the changelog.

## Deviations from upstream

The port follows upstream one-to-one except where JavaScript forces a different shape. The full list, per release, is in the [changelog](CHANGELOG.md).

### Unverifiable national checksums

Upstream (`2026.10.0`) always emits a `NationalChecksumNotVerified` Python warning when `validate_bban=True` meets check digits it cannot verify. Callers silence it or turn it into an error through the process-wide `warnings` filters (`warnings.simplefilter("error", NationalChecksumNotVerified)`).

JavaScript has no warnings machinery, and a process-wide filter would be mutable global state shared by every caller in the process. This port therefore makes the choice per call:

| Upstream (Python) | This port |
| --- | --- |
| Warning emitted by default | Silent by default (`unverifiedChecksum: "ignore"`) |
| Default `warnings` filter, reported once per location | `unverifiedChecksum: "warn"`, reported on every call through `process.emitWarning` / `console.warn` |
| `warnings.simplefilter("error", NationalChecksumNotVerified)` | `unverifiedChecksum: "error"` |
| `warnings.simplefilter("ignore", NationalChecksumNotVerified)` | Default; nothing to configure |
| Only observable through the warning | `IBAN.hasUnverifiableNationalChecksum` / `BBAN.hasUnverifiableNationalChecksum` |
| `NationalChecksumNotVerified(UserWarning)` | `NationalChecksumNotVerified extends SchwiftyException`, so a failure caught as `SchwiftyException` covers it |

The accept-or-reject outcome is the same as upstream: by default the IBAN is valid, and on request it fails.

## Issues

This package is a direct port of the Python library. Please file issues in the correct place:

- **TypeScript-specific bugs** (build, types, bundling, JS runtime issues): [schwifty-ts issues](https://github.com/madebyjulz/schwifty-ts/issues)
- **IBAN/BIC validation logic, bank registry data, checksum algorithms**: [schwifty (Python) issues](https://github.com/mdomke/schwifty/issues)

## Development

The project uses [pnpm](https://pnpm.io). Enable it with `corepack enable` if it is not installed; the pinned version is read from `packageManager` in `package.json`.

```bash
git submodule update --init
pnpm install
pnpm test        # vitest
pnpm check       # oxlint + oxfmt via ultracite
pnpm typecheck   # tsc
pnpm build       # tsdown, regenerates src/data first when the submodule is present
```

## License

`@madebyjulz/schwifty-ts` is released under the [MIT](https://choosealicense.com/licenses/mit/) license. The code is maintained on [GitHub](https://github.com/madebyjulz/schwifty-ts) and packages are distributed on [npm](https://www.npmjs.com/package/@madebyjulz/schwifty-ts).
