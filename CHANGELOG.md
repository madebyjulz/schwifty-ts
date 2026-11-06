# Changelog

Releases use [CalVer](https://calver.org/) in semver form, `YYYY.M.Patch`, keyed to the month the TypeScript package is released. Each entry names the upstream [schwifty](https://github.com/mdomke/schwifty) revision it was ported from; for the full upstream changelog see the [schwifty changelog](https://github.com/mdomke/schwifty/blob/main/CHANGELOG.rst).

## 2026.11.0 - 2026-11-06

Ports upstream [`2026.10.1`](https://github.com/mdomke/schwifty/commit/272ce99) (2026-10-25) and [`2026.11.0`](https://github.com/mdomke/schwifty/commit/f536720) (2026-11-05).

**Upgrade notes.** This release changes results that callers may depend on:

- `validateBban: true` now really checks national checksums, and `IBAN.generate` and `IBAN.random` compute them. See the first entry under Fixed.
- `IBAN.bic` and `BIC.fromBankCode` return the 8-character form of a primary office, e.g. `COBADEFF` instead of `COBADEFFXXX`. Compare BICs through `BIC.canonical`.
- Bank codes that are no longer in use now resolve instead of returning `null`. Check `Bank.status` before initiating a payment.
- `Bank.bic` is `string | null`.

### Added

- `BankStatus` and `Bank.status`: `active`, `merged`, `closed` or `delisted`. A merged bank code names its successor as `Bank.successor_bank_code` where it is known and takes on the name and BIC of the bank that services it today, while the merged bank's own name and BIC are kept as `Bank.legacy_name` and `Bank.legacy_bic`. The legacy BIC still resolves, e.g. `new BIC("GENODEF1HWR").domesticBankCodes`. Account codes of retired banks are validated with their own checksum method.
- `BIC.canonical`: the canonical form of a BIC. ISO 9362 treats a BIC without branch code and the same BIC with the branch code `XXX` as identical, so `new BIC("REVOGB21XXX").canonical` is `REVOGB21`.
- `BIC.banks`: the bank records of a BIC in the registry.
- `IBAN.isAspirational` and `BBAN.isAspirational`: whether a country's IBAN format is only reserved and not yet part of the official IBAN registry.
- German checksum methods `31`, `40`, `41`, `42`, `43`, `44`, `46`, `47`, `48`, `49`, `50`, `A7`, `C0` and `C1`. Account codes of the banks using them were not checked before.
- `pnpm parity`: compares the build with the Python package over about 150,000 generated IBANs, BICs and bank codes. It runs before every publish.
- `/port-upstream`: a Claude Code skill for the porting workflow.

### Changed

- All lookups by bank code rank the records by status, then by how generic their BIC is, then by `primary`, so `IBAN.bank`, `IBAN.bic` and `BIC.fromBankCode` always describe the same institution. An active branch now wins over a retired head office. This changes `IBAN.bank` for about 130 bank codes and the order of `BIC.candidatesFromBankCode`, whose first candidate is now the BIC that `BIC.fromBankCode` returns. Equivalent forms of a BIC are listed once. The UK bank code `REVO` now resolves to Revolut Bank UK instead of Revolut Ltd.
- The BIC of an institution's primary office is always returned in its 8-character form. `BIC.exists` is `true` for both forms, and `getBanksByBic` finds the same banks for both.
- BIC lookups only search the registry of the BIC's own country. Foreign-based banks listed in another country's registry, such as Commerzbank (`COBADEFF`) with its Swiss bank codes, are no longer returned for their BIC. This also fixes `new BIC("REVOFRP2XXX").domesticBankCodes` returning the Lithuanian `32501` instead of the French `28233`.
- `BBAN.random` and `IBAN.random` never pick a retired bank code. With a pinned bank code they solve the national check digit for the checksum method of that bank, also with `useRegistry: false`, instead of the method of a randomly picked bank.
- `getAllBanks()` returns the banks grouped by country.
- Registries: bank codes that are no longer listed are kept in the registries of most countries, so existing IBANs still resolve, and marked as `delisted`, `merged` or `closed`. The registries of the UK, Georgia, Estonia, Italy, Romania, Sweden, Slovakia and Croatia are generated from current official sources, and many other countries are updated. The [upstream changelog](https://github.com/mdomke/schwifty/blob/main/CHANGELOG.rst) has the details per country.
- IBAN registry: updated from the latest SWIFT release. Honduras and Yemen are part of the official registry, Iceland is in the SEPA zone, and the BBAN structure of Brazil is more liberal.
- The bundle grows from 3.6 MB to 4.2 MB (380 KB gzipped) with the registry data.
- `pnpm sync:upstream` only records the upstream revision with `--record`, once a port is done. Its summary leaves out registry data and includes upstream's decision records. `scripts/consolidate-registry.ts` fails on registry fields the bundle does not cover instead of dropping them.

### Fixed

- **The published package registered no national checksum algorithms** (`2026.9.0-rc1` and `2026.10.0`). `sideEffects` in `package.json` named only the bundle, so the bundler dropped the imports that register them. `validateBban: true` accepted every national checksum, and `IBAN.generate` wrote wrong check digits for countries that compute them, e.g. `00` for Belgium, France and Spain. The tests ran against the source and did not notice; `pnpm parity` tests the build.
- German method `24` accepts the account code `0000000000`, like upstream.
- `Bank.bic` is `null` for banks without a BIC, like upstream, instead of an empty string.
- BICs of banks in Kosovo (e.g. `RBKOXKPR`) no longer throw `InvalidCountryCode`.
- Kosovo (`XK`) national check digits are validated with ISO 7064 mod 97-10. `IBAN.accountCode` is now the 10-digit client number, and the check digits are available as `IBAN.nationalChecksumDigits`. `IBAN.generate` computes them.
- German method `76` no longer accepts a check digit of 0 for a remainder of 10, and accepts account codes whose sub-account `00` was left out and padded with leading zeros instead.
- German method `13` accepts account codes whose sub-account `00` was left out and padded with leading zeros instead.

### Deviations from upstream

- Per-country registry: upstream reads a country's registry files on first use. The registry is bundled here, so `_bankRows` groups the rows by country in place of `_bank_files`. Parsing and indexing still happen per country in `_getCountryBanks`, and the upstream memory savings do not apply.
- `lookup_rank` returns a tuple that Python orders natively. `compareLookupRank` spells out that comparison.
- `BankStatus` is a const object, like `Component`.
- `registry.parseBank` does not reject an unknown status, since the rows are generated. `pnpm parity` compares every record.
- Not applicable: `__slots__` and dict-style `Bank` access, the pydantic pattern fix (`bicSchema()` has no pattern), the seeded `random` output (the port has no `random` parameter) and the registry scripts.

## 2026.10.0 - 2026-10-19

Ports upstream [`2026.10.0`](https://github.com/mdomke/schwifty/commit/810930b) (2026-10-19). The registry additions, the 11-character BIC fallback and the internal simplifications of that release were already ported in `2026.9.0-rc1`.

### Added

- German checksum method `95` (UniCredit Bank - HypoVereinsbank, bank code `70020270`): computed like method `06`, with the account ranges the Bundesbank exempts from the check digit treated as valid. Account codes for this bank were not checked before.
- German checksum methods `A2` and `A3` (e.g. Nassauische Sparkasse, Sparkasse Hannover): method `00` first, falling back to `04` (`A2`) or `10` (`A3`). Their check digits were previously accepted unverified.
- `NationalChecksumNotVerified` and the `unverifiedChecksum` option (`"ignore"`, `"warn"`, `"error"`) on `IBAN`, `IBAN.fromBban`, `IBAN.validate`, `BBAN.validateNationalChecksum` and `ibanSchema()`.
- `IBAN.hasUnverifiableNationalChecksum` and `BBAN.hasUnverifiableNationalChecksum`: whether the country declares national check digits that no registered algorithm can verify.
- ORO PAY LTD (`OROACY2LXXX`) to the Cypriot registry.

### Changed

- `validateBban: true` can now report or reject national check digits that no registered algorithm can verify (35 of the 54 countries that declare check digits, e.g. `HU` and `SE`). They are still accepted by default; `unverifiedChecksum: "warn"` reports a `NationalChecksumNotVerified` warning and `"error"` throws it. `BBAN.random` never reports it.
- Updated the bank registries for Germany, Austria, Belgium, Poland, Switzerland and Slovenia. Retired Swiss IIDs of merged institutes (e.g. former Credit Suisse codes, now UBS) and the retired Slovenian SKB banka and Abanka codes are kept as aliases of their successors.

### Fixed

- German method `63` (Deutsche Bank) accepts account numbers whose sub-account `00` was left out and padded with leading zeros instead (e.g. `0001234566`).
- German method `99` accepts every account number from `0396000000` to `0499999999` without a check, not only the two range boundaries.
- German methods that inspect the account code themselves (`08`, `63`, `68`, `76`, `88`, `99`) and the shared solver throw `InvalidAccountCode` for a BBAN too short to carry a 10-digit account code. Previously the truncated value was silently checked.
- `IBAN.fromBban` normalizes whitespace and case before computing the check digits, so grouped BBANs and lowercase country codes work.
- `IBAN.bank` (and `bankName`/`bankShortName`) resolves a bank code to the registry record flagged `primary` instead of the first one read, so it names the same institution as `IBAN.bic`.
- `BIC.fromBankCode` prefers BICs the registry marks as primary among equally generic candidates before the alphabetical tie-break: French bank code `18719` resolves to the head office `BFCORERXXXX` instead of the Mayotte branch `BFCOYTYTXXX`, German `48020151` to `HAUKDEFFXXX` instead of `LAMPDEDDXXX`.
- Eight-character BICs fall back to their `XXX` registry entry for `domesticBankCodes`, `bankNames` and `bankShortNames` when no exact entry exists.

### Deviations from upstream

- Unverifiable national checksums: upstream always emits a Python `UserWarning` and leaves silencing or escalating it to the process-wide `warnings` filters. JavaScript has no such machinery and a global filter would be shared mutable state, so this port is silent by default and takes a per-call `unverifiedChecksum` option instead, adds the `hasUnverifiableNationalChecksum` getter, and makes `NationalChecksumNotVerified` a `SchwiftyException`. See [Deviations from upstream](README.md#deviations-from-upstream).
- `IBANSpec.has_positions` is the existing `hasPositions(spec)` function, since `IBANSpec` is a plain interface.
- Not applicable: deep-copy support for `allowInvalid` instances (no `__deepcopy__` in JavaScript), the pydantic non-string `BIC` fix (`bicSchema()` already reports non-strings as an issue), dropping Python 3.10, and the `httpx2` registry scripts.
- Resolved: upstream now generates random BBANs for countries without component positions from the regex, so the `2026.07.3` deviation below no longer applies.

## 2026.9.0-rc1 - 2026-09-14

Ports upstream `2026.07.3` plus the unreleased upstream commits through [`394bdfb`](https://github.com/mdomke/schwifty/commit/394bdfb) (2026-09-04).

### Added

- E-money institutions and banks that were missing from the bank registries: OpenPayd (MT, first Maltese registry), ClearBank and Bilderlings Pay (GB), Score and Secure Payment and Deblock (FR), bunq, Pecunia Cards and Financière des Paiements Électroniques (ES), Unlimit (CY), MyFin (BG), Revolut Bank (PT), Enpara Bank (TR), United Bank and Allied Bank (PK, first Pakistani registry), and the BIC for PrivatBank (UA).
- `BIC.domesticBankCodes`, `bankNames` and `bankShortNames` fall back to the 8-character institution BIC when the registry has no entry for the 11-character branch BIC.
- `ibanSchema()` and `bicSchema()`: [Standard Schema](https://standardschema.dev) validators that parse a string into an `IBAN`/`BIC`. The TypeScript counterpart of upstream's pydantic support.
- `mod97()`: integer-only `numerify(value) % 97`.
- `pnpm sync:upstream` (`scripts/sync-upstream.ts`) updates the submodule, prints the upstream diff to port, regenerates the registry and records the ported revision under `schwifty.upstream` in `package.json`.
- GitHub Actions: lint, typecheck, test and build on every push; a check that `src/data` matches the submodule; a weekly job that opens an issue when upstream publishes an unported release.

### Changed

- Simplified the IBAN checksum validation. The redundant `numeric % 97n === 1n` test has been dropped in favour of the stricter canonical `ISO7064Mod97_10` comparison, which it always implied. Behaviour is unchanged.
- Simplified internal character lookups, checksum helpers and validation routines while preserving exact behaviour (`numerify` lookup map, Italian and Norwegian checksums, German `digitSum` fast path, `Base._getSlice`).
- `ISO7064Mod97_10` computes the remainder with integer arithmetic instead of `bigint`, which makes IBAN validation about twice as fast. The `preProcess` hook is replaced by `remainder`, which Belgium and France override. `IBAN.numeric` still returns a `bigint`.
- The bank registry is bundled as a positional tuple per bank inside one `JSON.parse` string instead of an inlined array of objects. The published bundle shrinks from 6.2 MB to 3.6 MB (300 KB gzipped) and imports faster. `getAllBanks()` and friends are unchanged.
- Source maps no longer embed the registry source (23 KB instead of 4.4 MB).
- Versions are the package's own release-month CalVer (`2026.9.0`) instead of mirroring the upstream version; the ported upstream revision is recorded in `package.json`.
- `package.json`: `types` condition listed first, `engines.node >= 22.6`, `sideEffects` declared for the checksum registration.
- README and changelog are Markdown so npm renders them.
- Published under the `@madebyjulz` scope as `@madebyjulz/schwifty-ts`.

### Fixed

- `BIC.fromBankCode` returned `undefined` (typed as `BIC`) and `IBAN.bic` returned `undefined` instead of `null` when every registry entry for a bank code lacks a BIC (e.g. `BE` `102`). It now throws `InvalidBankCode` like the Python implementation.

## 2026.07.3 - 2026-07-23

Pre-npm release; the version mirrored upstream. Ports upstream `2026.07.0` through `2026.07.3`.

### Added

- Yemen (`YE`) to the IBAN registry.
- `BBAN.random` now _constructs_ a valid national checksum instead of generating candidates until one happens to validate. Each checksum algorithm can `solve` the components it owns: the German methods splice a valid check digit into the account code, Iceland fixes its embedded check digit, and the Czech and Slovak methods adjust the account and branch codes to satisfy their mod-11 constraints. Random IBANs are now produced on the first attempt for effectively every country and bank.
- Typed registry queries `getIbanSpec`, `getBanksByCountry`, `getBanksByCode`, `getBanksByBic`, `getCountries` and `getAllBanks`, replacing the untyped `registry.get`/`has`/`save`/`buildIndex`/`manipulate` helpers. Indexes are now built lazily on first use rather than as an import side effect.

### Changed

- `IBAN.spec` returns an `IBANSpec` and `IBAN.bank`/`BBAN.bank` return a `Bank`. `spec.positions` is now a `Record<Component, Range>` that is always fully populated, `spec.bic_lookup_components` is always an array, and `spec.default_currency_code` moved into `spec.defaults`. Upstream's Python-only dict-access compatibility shim is not ported; attribute access already was the only option here.
- `convertBbanSpecToRegex` moved from `iban.ts` to `registry.ts`.

### Fixed

- IBAN character validation is anchored over the whole string. It previously matched only the country/check-digit prefix and excluded digits from the BBAN, so invalid characters further along slipped through.
- Registered the ISO 7064 mod 97-10 national checksum for Bosnia and Herzegovina (`BA`) instead of `BT` (Bhutan, which has no IBAN).
- `BBAN.validateNationalChecksum` returns `true` on success. It previously returned `false` when an algorithm had run and validated.
- German checksum method `08`: the check digit applies from account number `60000` upward, not `6000`.
- German checksum method `16`: computed like method `06` over account positions `1-9`; only method `15` is restricted to positions `6-9`.
- German checksum method `11`: a computed check digit of `11` now maps to `0` instead of being compared against as a two-digit value.
- Updated bank registries for Germany, Poland, France and Ireland.

### Deviations from upstream

- Upstream `2026.07.2` made `IBANSpec.positions` always fully populated, which turned its "no positional layout" fast path into dead code. In upstream `2026.07.3` `BBAN.random` therefore returns an all-zero BBAN for the seven countries the registry has no layout for (`AO`, `GW`, `HN`, `IR`, `KM`, `MG`, `MZ`). This port keeps generating those from the BBAN regex, as before.

## 2026.03.0 - 2026-03-06

Initial release. Pure TypeScript port of [schwifty](https://github.com/mdomke/schwifty) `2026.03.0`.

### Ported from Python

- Full IBAN validation (check digits, country format, length)
- Full BIC validation (ISO 9362 and SWIFT compliance modes)
- IBAN/BIC generation from components
- Random IBAN generation
- BIC lookup from domestic bank code
- All country-specific national checksum algorithms (Germany, Belgium, France, Italy, Spain, Norway, Finland, Estonia, Czech Republic, Iceland, Poland, and others)
- Complete bank registry data (same JSON source as Python package)
- SEPA zone detection
- All BBAN component accessors

### TypeScript-specific

- Zero runtime dependencies
- ESM-only package
- Full type definitions included
