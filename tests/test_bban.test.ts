import { afterEach, describe, expect, it, vi } from "vitest";
import { BBAN } from "../src/bban.ts";
import {
  GenerateRandomOverflowError,
  InvalidAccountCode,
  InvalidBBANChecksum,
  NationalChecksumNotVerified,
  SchwiftyException,
} from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";
import * as registry from "../src/registry.ts";
import * as warnings from "../src/warnings.ts";

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

describe("BBAN national checksum without a registered algorithm", () => {
  afterEach(() => {
    warnings.resetwarnings();
    vi.restoreAllMocks();
  });

  // Both countries declare a national check-digit field (HU: 23-24, SE: 19-20) but have no
  // algorithm registered for it, so their check digits were accepted without being looked
  // at. A missing algorithm must not reject an otherwise valid BBAN, but the pass is no
  // longer silent.
  it.each(["HU", "SE"])("reports the unverified check digits of %s", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue();
    warnings.simplefilter("always", NationalChecksumNotVerified);

    expect(iban.bban.validateNationalChecksum()).toBeTruthy();
    expect(iban.validate(true)).toBeTruthy();
    expect(() => new IBAN(iban.compact, { validateBban: true })).not.toThrow();
    expect(emitWarning).toHaveBeenCalledTimes(3);
    const [[warning]] = emitWarning.mock.calls;
    expect(warning).toBeInstanceOf(NationalChecksumNotVerified);
    expect(String(warning)).toContain(countryCode);
  });

  it.each(["HU", "SE"])("turns the warning for %s into an error on request", (countryCode) => {
    const iban = IBAN.random(countryCode, { useRegistry: false });
    warnings.simplefilter("error", NationalChecksumNotVerified);

    expect(() => iban.bban.validateNationalChecksum()).toThrow(NationalChecksumNotVerified);
    expect(() => new IBAN(iban.compact, { validateBban: true })).toThrow(NationalChecksumNotVerified);
    expect(new IBAN(iban.compact).isValid).toBeTruthy();
  });

  // Mirrors Python's default filter: one report per distinct warning.
  it("reports each country once by default", () => {
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue();
    warnings.resetwarnings();
    const iban = IBAN.random("HU", { useRegistry: false });
    iban.bban.validateNationalChecksum();
    iban.bban.validateNationalChecksum();
    expect(emitWarning).toHaveBeenCalledOnce();
  });

  it("silences the warning on request", () => {
    const emitWarning = vi.spyOn(process, "emitWarning").mockReturnValue();
    warnings.simplefilter("ignore", NationalChecksumNotVerified);
    IBAN.random("SE", { useRegistry: false }).bban.validateNationalChecksum();
    expect(emitWarning).not.toHaveBeenCalled();
  });

  // Countries that declare no national check digits have nothing to verify, so there is
  // nothing to report either.
  it("is silent without declared check digits", () => {
    warnings.simplefilter("error");
    expect(new BBAN("GB", "WEST12345698765432").validateNationalChecksum()).toBeTruthy();
  });

  // Generating a random BBAN is not a validation request: it neither reports a checksum it
  // cannot verify nor exhausts its retries over it.
  it("is not reported by random()", () => {
    warnings.simplefilter("error");
    expect(BBAN.random("HU").countryCode).toBe("HU");
  });
});

describe("BBAN bank", () => {
  // A national registry lists one record per branch, so a bank code maps to several
  // entries and `primary` marks the institution's main record. For the Nord LB codes
  // the branch record is listed before the institution's own record.
  it("prefers the primary registry record", () => {
    const iban = IBAN.generate("DE", "29050000", "0000000000");
    expect(iban.bic?.compact).toBe("BRLADE22XXX");
    expect(iban.bank).not.toBeNull();
    expect(iban.bank?.bic).toBe(iban.bic?.compact);
    expect(iban.bank?.primary).toBeTruthy();
    expect(iban.bankShortName).toBe("Nord LB Bremen");
  });

  // Whenever the registry marks a record of a bank code as the primary one, that is the
  // record the bank code has to resolve to.
  it("prefers the primary record of every registered bank code", () => {
    const notPrimary: [string, string, string][] = [];
    for (const countryCode of registry.getCountries()) {
      const bankCodes = new Set(registry.getBanksByCountry(countryCode).map((bank) => bank.bank_code));
      for (const bankCode of bankCodes) {
        const entries = registry.getBanksByCode(countryCode, bankCode);
        if (!bankCode || !entries.some((bank) => bank.primary)) {
          continue;
        }
        const { bank } = BBAN.fromComponents(countryCode, { bank_code: bankCode });
        if (bank !== null && !bank.primary) {
          notPrimary.push([countryCode, bankCode, bank.bic]);
        }
      }
    }
    expect(notPrimary).toStrictEqual([]);
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
  it.each(["AO", "GW", "HN", "IR", "KM", "MG", "MZ"])("generates a non-empty BBAN for %s", (countryCode) => {
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
    expect(() => BBAN.fromComponents("HN", { bank_code: "BGAH", account_code: "12345678901234567890" })).toThrow(
      "BBAN generation for HN not supported",
    );
  });

  it("throws once the retries are exhausted", () => {
    vi.spyOn(BBAN.prototype, "validateNationalChecksum").mockImplementation(() => {
      throw new InvalidBBANChecksum("Invalid national checksum");
    });
    expect(() => BBAN.random("DE")).toThrow(GenerateRandomOverflowError);
  });
});
