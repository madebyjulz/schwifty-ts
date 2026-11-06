import { afterEach, describe, expect, it, vi } from "vitest";
import { BBAN } from "../src/bban.ts";
import { BIC } from "../src/bic.ts";
import type { Bank } from "../src/domain.ts";
import { compareLookupRank } from "../src/domain.ts";
import {
  GenerateRandomOverflowError,
  InvalidAccountCode,
  InvalidBBANChecksum,
  NationalChecksumNotVerified,
  SchwiftyException,
} from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";
import * as registry from "../src/registry.ts";

describe("BBAN national checksum", () => {
  // A valid national checksum returns true (consistent with the "no checksum
  // algorithm" case), while an invalid one throws InvalidBBANChecksum.
  it("validates and rejects", () => {
    expect(new BBAN("BE", "539007547034").validateNationalChecksum()).toBeTruthy();
    expect(new BBAN("GB", "WEST12345698765432").validateNationalChecksum()).toBeTruthy();
    expect(() => new BBAN("BE", "539007547035").validateNationalChecksum()).toThrow(InvalidBBANChecksum);
  });

  // Bosnia and Herzegovina uses ISO 7064 mod 97-10; it was registered under the
  // wrong country code "BT" (Bhutan, which has no IBAN), so the national
  // checksum was never validated.
  it("validates Bosnia and Herzegovina", () => {
    expect(new BBAN("BA", "1290079401028494").validateNationalChecksum()).toBeTruthy();
    expect(() => new BBAN("BA", "1290079401028400").validateNationalChecksum()).toThrow(InvalidBBANChecksum);
  });

  // The per-bank German checksum method is selected via the bank's
  // `checksum_algo` field. Commerzbank (bank code 37040044) uses method 13,
  // whose check digit sits at account position 8.
  it("validates the per-bank German method", () => {
    expect(new BBAN("DE", "370400440532013000").validateNationalChecksum()).toBeTruthy();
    expect(() => new BBAN("DE", "370400440532013100").validateNationalChecksum()).toThrow(InvalidBBANChecksum);
  });

  // A BBAN that is too short to carry the 10-digit German account code has to be
  // rejected with InvalidAccountCode, no matter which method the bank uses.
  it.each([
    "37040044", // Commerzbank, method 13
    "30022000", // NRW.BANK, method 08
    "10070000", // Deutsche Bank, method 63
    "20030000", // UniCredit Bank - HypoVereinsbank, method 68
    "10080000", // Commerzbank vorm. Dresdner Bank, method 76
    "70090100", // Hausbank München, method 88
    "10020890", // UniCredit Bank - HypoVereinsbank, method 99
    "50010517", // ING-DiBa, method C1
    "13051042", // Sparkasse Vorpommern auf Rügen, method C0
    "50324000", // ABN AMRO Bank, Frankfurt Branch, method 31
    "35060386", // Volksbank Rhein-Ruhr, method 40
    "25020600", // Openbank Deutschland, method 41
    "66661454", // VR Bank im Enzkreis -alt-, method 42
    "66690000", // Volksbank Pforzheim -alt-, method 43
    "30060010", // DZ BANK, method 44
    "50310400", // Barclays Bank Ireland Frankfurt Branch, method 46
    "27290087", // Volksbank Weserbergland -alt-, method 47
    "20190109", // Volksbank Raiffeisenbank, method 48
    "40351060", // Kreissparkasse Steinfurt, method 49
    "20090700", // Edekabank, method 50
    "21352240", // Sparkasse Holstein, method A7
  ])("rejects a truncated BBAN for bank code %s", (bankCode) => {
    expect(() => new BBAN("DE", `${bankCode}05320`).validateNationalChecksum()).toThrow(InvalidAccountCode);
  });

  // The same invariant across all methods the German registry refers to: a truncated
  // BBAN is either rejected with a schwifty exception or carries no national checksum
  // at all, but no other error may escape.
  it("never lets a non-schwifty error escape for a truncated German BBAN", () => {
    const escaped: unknown[] = [];
    for (const bank of registry.getBanksByCountry("DE")) {
      try {
        new BBAN("DE", `${bank.bank_code}05320`).validateNationalChecksum();
      } catch (error) {
        if (!(error instanceof SchwiftyException)) {
          escaped.push(error);
        }
      }
    }
    expect(escaped).toStrictEqual([]);
  });
});

describe("BBAN national checksum for Kosovo", () => {
  // The last two digits of a Kosovo BBAN are check digits computed with ISO 7064 mod 97-10,
  // like in the other former Yugoslav countries. Example taken from the Central Bank of Kosovo.
  it("validates the national check digits", () => {
    const bban = new BBAN("XK", "1212012345678906");
    expect(bban.bankCode).toBe("12");
    expect(bban.branchCode).toBe("12");
    expect(bban.accountCode).toBe("0123456789");
    expect(bban.nationalChecksumDigits).toBe("06");
    expect(bban.validateNationalChecksum()).toBeTruthy();
    expect(() => new BBAN("XK", "1212012345678907").validateNationalChecksum()).toThrow(InvalidBBANChecksum);
    expect(() => IBAN.fromBban("XK", "1212012345678907", { validateBban: true })).toThrow(InvalidBBANChecksum);
  });
});

describe("BBAN national checksum without a registered algorithm", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Both countries declare a national check-digit field (HU: 23-24, SE: 19-20) but have no
  // algorithm registered for it, so their check digits are accepted without being looked at.
  // A missing algorithm must not reject an otherwise valid BBAN, but callers can now tell.
  it.each(["HU", "SE"])("exposes the unverifiable check digits of %s", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    expect(iban.bban.hasUnverifiableNationalChecksum).toBeTruthy();
    expect(iban.hasUnverifiableNationalChecksum).toBeTruthy();
  });

  it.each(["HU", "SE"])("accepts the check digits of %s silently by default", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue(null);

    expect(iban.bban.validateNationalChecksum()).toBeTruthy();
    expect(iban.validate(true)).toBeTruthy();
    expect(() => new IBAN(iban.compact, { validateBban: true })).not.toThrow();
    expect(emitWarning).not.toHaveBeenCalled();
  });

  it.each(["HU", "SE"])("reports the unverified check digits of %s on request", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue(null);
    const options = { unverifiedChecksum: "warn" } as const;

    expect(iban.bban.validateNationalChecksum(options)).toBeTruthy();
    expect(iban.validate(true, options)).toBeTruthy();
    expect(() => new IBAN(iban.compact, { validateBban: true, ...options })).not.toThrow();
    expect(emitWarning).toHaveBeenCalledTimes(3);
    const [[warning]] = emitWarning.mock.calls;
    expect(warning).toBeInstanceOf(NationalChecksumNotVerified);
    expect(String(warning)).toContain(countryCode);
  });

  it.each(["HU", "SE"])("rejects the check digits of %s on request", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    const options = { unverifiedChecksum: "error" } as const;

    expect(() => iban.bban.validateNationalChecksum(options)).toThrow(NationalChecksumNotVerified);
    expect(() => iban.validate(true, options)).toThrow(NationalChecksumNotVerified);
    expect(() => new IBAN(iban.compact, { validateBban: true, ...options })).toThrow(SchwiftyException);
    // Without `validateBban` the national checksum is not looked at at all.
    expect(() => new IBAN(iban.compact, options)).not.toThrow();
  });

  // Countries that declare no national check digits have nothing to verify, so there is
  // nothing to report either.
  it("has nothing to report without declared check digits", () => {
    const bban = new BBAN("GB", "WEST12345698765432");
    expect(bban.hasUnverifiableNationalChecksum).toBeFalsy();
    expect(bban.validateNationalChecksum({ unverifiedChecksum: "error" })).toBeTruthy();
  });

  // A registered algorithm verifies the digits, so they are not unverifiable.
  it("is not unverifiable with a registered algorithm", () => {
    expect(new BBAN("BE", "539007547034").hasUnverifiableNationalChecksum).toBeFalsy();
  });

  // Generating a random BBAN is not a validation request: it neither reports a checksum it
  // cannot verify nor exhausts its retries over it.
  it("is not reported by random()", () => {
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue(null);
    expect(BBAN.random("HU").countryCode).toBe("HU");
    expect(emitWarning).not.toHaveBeenCalled();
  });
});

describe("BBAN bank", () => {
  // A national registry lists one record per branch, so a bank code maps to several
  // entries and `primary` marks the institution's main record. For the Nord LB codes
  // the branch record is listed before the institution's own record.
  it("prefers the primary registry record", () => {
    const iban = IBAN.generate("DE", "29050000", "0000000000");
    expect(iban.bic?.compact).toBe("BRLADE22");
    expect(iban.bank).not.toBeNull();
    expect(iban.bank?.bic).toBe(iban.bic?.compact);
    expect(iban.bank?.primary).toBeTruthy();
    expect(iban.bankShortName).toBe("Nord LB Bremen");
  });

  // Banco di Sicilia was absorbed by UniCredito Italiano (03135), which continued as UniCredit
  // under the bank code 02008. The register links the two codes only by their common tax code.
  it("resolves a merged bank to its successor under a new bank code", () => {
    const bban = BBAN.fromComponents("IT", {
      bank_code: "01020",
      branch_code: "00000",
      account_code: "0".repeat(12),
    });
    expect(bban.bank?.status).toBe("merged");
    expect(bban.bank?.successor_bank_code).toBe("03135");
    expect(bban.bank?.legacy_name).toBe("BANCO DI SICILIA S.P.A.");
    expect(bban.bank?.name).toBe("UNICREDIT, SOCIETA' PER AZIONI");
    expect(bban.bic?.compact).toBe("UNCRITMM");
  });

  // `BBAN.bank` and `BBAN.bic` used to pick their record differently, so that e.g. the
  // name of Revolut Bank UK came with the BIC of Revolut Ltd.
  it("describes the same record with bank and bic for every registered bank code", () => {
    const disagree: unknown[] = [];
    for (const countryCode of registry.getCountries()) {
      const bankCodes = new Set(registry.getBanksByCountry(countryCode).map((bank) => bank.bank_code));
      for (const bankCode of bankCodes) {
        if (!bankCode) {
          continue;
        }
        const bban = BBAN.fromComponents(countryCode, { bank_code: bankCode });
        const { bank, bic } = bban;
        if (bank?.bic && bic?.canonical.compact !== new BIC(bank.bic).canonical.compact) {
          disagree.push([countryCode, bankCode, bank.bic, bic?.compact]);
        }
      }
    }
    expect(disagree).toStrictEqual([]);
  });

  // A bank code has to resolve to its best ranked record: an active one before a retired
  // one, and the primary one among those.
  it("prefers the best ranked record of every registered bank code", () => {
    const notBest: unknown[] = [];
    for (const countryCode of registry.getCountries()) {
      const bankCodes = new Set(registry.getBanksByCountry(countryCode).map((bank) => bank.bank_code));
      for (const bankCode of bankCodes) {
        if (!bankCode) {
          continue;
        }
        const entries = registry.getBanksByCode(countryCode, bankCode);
        const { bank } = BBAN.fromComponents(countryCode, { bank_code: bankCode });
        if (bank !== null && entries.some((entry) => compareLookupRank(entry, bank) > 0)) {
          notBest.push([countryCode, bankCode, bank.bic]);
        }
      }
    }
    expect(notBest).toStrictEqual([]);
  });
});

describe("BBAN random", () => {
  const countryCodes = ["DE", "ES", "GB", "FR", "PL"];

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(countryCodes)("generates valid BBANs for %s", (countryCode) => {
    const n = 100;
    const bbans: BBAN[] = [];
    for (let i = 0; i < n; i++) {
      const bban = BBAN.random(countryCode);
      bbans.push(bban);
    }
    // Check that we get some variety
    const unique = new Set(bbans.map((b) => b.compact));
    expect(unique.size).toBeGreaterThan(10);

    for (const bban of bbans) {
      expect(bban.bank).not.toBeNull();
      expect(bban.countryCode).toBe(countryCode);
    }
  });

  it.each(countryCodes)("random without registry for %s produces some with no bank", (countryCode) => {
    const n = 100;
    let hasNullBank = false;
    for (let i = 0; i < n; i++) {
      const bban = BBAN.random(countryCode, { useRegistry: false });
      if (bban.bank === null) {
        hasNullBank = true;
        break;
      }
    }
    expect(hasNullBank).toBeTruthy();
  });

  // Countries the registry has no positional layout for have to be generated
  // straight from the BBAN regex. Deriving "has a layout" from the mere presence
  // of a `positions` map — which is now always populated, one empty range per
  // component — degrades these to an all-zero BBAN.
  it.each(["AO", "GW", "IR", "KM", "MG", "MZ"])("generates a non-empty BBAN for %s", (countryCode) => {
    const bbans = Array.from({ length: 20 }, () => BBAN.random(countryCode).compact);
    for (const bban of bbans) {
      expect(bban).not.toMatch(/^0+$/u);
    }
    expect(new Set(bbans).size).toBeGreaterThan(1);
  });

  // When no generated candidate ever satisfies the national checksum, random()
  // exhausts its retries and throws GenerateRandomOverflowError rather than
  // returning a BBAN with an invalid checksum.
  // Without component positions a BBAN cannot be assembled from components. This
  // raises the explicit "not supported" error rather than the misleading "Bank code
  // exceeds maximum size 0".
  it("rejects fromComponents for a country without positions", () => {
    expect(() => BBAN.fromComponents("AO", { bank_code: "1234", account_code: "12345678901234567" })).toThrow(
      "BBAN generation for AO not supported",
    );
  });

  it("throws once the retries are exhausted", () => {
    vi.spyOn(BBAN.prototype, "validateNationalChecksum").mockImplementation(() => {
      throw new InvalidBBANChecksum("Invalid national checksum");
    });
    // Pin the bank `random` picks to one whose checksum method is implemented. The
    // validator is only consulted for those, and a bank with an unimplemented method
    // leaves nothing to retry and no overflow to raise.
    const deutscheBank: Bank[] = registry.getBanksByCode("DE", "10070000");
    expect(deutscheBank.map((bank) => bank.checksum_algo)).toStrictEqual(["63"]);
    vi.spyOn(registry, "getBanksByCountry").mockReturnValue(deutscheBank);
    expect(() => BBAN.random("DE")).toThrow(GenerateRandomOverflowError);
  });
  // The result is validated against the checksum method of the requested bank, so the
  // check digit has to be solved for that method too.
  describe.each([true, false])("with a pinned bank code and useRegistry %s", (useRegistry) => {
    it.each([
      ["10070000", "63"], // Deutsche Bank
      ["10110600", "17"], // Quirin Privatbank
      ["50010517", "C1"], // ING-DiBa
      ["13051042", "C0"], // Sparkasse Vorpommern auf Rügen
      ["50324000", "31"], // ABN AMRO Bank, Frankfurt Branch
      ["35060386", "40"], // Volksbank Rhein-Ruhr
      ["25020600", "41"], // Openbank Deutschland
      ["66661454", "42"], // VR Bank im Enzkreis -alt-
      ["66690000", "43"], // Volksbank Pforzheim -alt-
      ["30060010", "44"], // DZ BANK
      ["50310400", "46"], // Barclays Bank Ireland Frankfurt Branch
      ["27290087", "47"], // Volksbank Weserbergland -alt-
      ["20190109", "48"], // Volksbank Raiffeisenbank
      ["40351060", "49"], // Kreissparkasse Steinfurt
      ["20090700", "50"], // Edekabank
      ["21352240", "A7"], // Sparkasse Holstein
    ])("uses the checksum method of bank %s", (bankCode, checksumAlgo) => {
      const methods = new Set(registry.getBanksByCode("DE", bankCode).map((bank) => bank.checksum_algo));
      expect([...methods]).toStrictEqual([checksumAlgo]);
      for (let attempt = 0; attempt < 50; attempt++) {
        const bban = BBAN.random("DE", { useRegistry, values: { bank_code: bankCode } });
        expect(bban.bankCode).toBe(bankCode);
        expect(bban.validateNationalChecksum()).toBeTruthy();
      }
    });

    // The check digit has to be solved for the bank the result is validated against, so
    // random() has to look the bank up with the same key validation uses later.
    it.each([
      // Cut to the eight digits of the bank code field, so the result belongs to
      // Deutsche Bank (method 63).
      ["DE", { bank_code: "100700001" }, "10070000"],
      // Slovenian banks are looked up by bank and branch code together.
      ["SI", { bank_code: "01", branch_code: "000" }, "01000"],
    ])("looks up the bank of %s like validation", (countryCode, values, lookupKey) => {
      const lookup = vi.spyOn(registry, "getBanksByCode");
      for (let attempt = 0; attempt < 20; attempt++) {
        const bban = BBAN.random(countryCode, { useRegistry, values });
        expect(bban.bank).not.toBeNull();
        expect(bban.validateNationalChecksum()).toBeTruthy();
      }
      expect(new Set(lookup.mock.calls.map(([, bankCode]) => bankCode))).toStrictEqual(new Set([lookupKey]));
    });
  });
});
