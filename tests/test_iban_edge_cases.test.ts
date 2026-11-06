import { describe, expect, it } from "vitest";
import { BBAN } from "../src/bban.ts";
import { InvalidBBANChecksum, InvalidChecksumDigits } from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";

const MOD97 = 97n;

describe("IBAN edge cases", () => {
  // The ISO 7064 check digits are only ever generated in the range 02..98, but the raw
  // `numeric % 97 == 1` test also accepts the aliases that differ by 97. Validation
  // compares against the canonically computed digits, so the aliases must be rejected.
  it.each([
    ["DE02370400440000000024", "DE99370400440000000024"],
    ["DE98370400440000000042", "DE01370400440000000042"],
    ["DE97370400440000000060", "DE00370400440000000060"],
  ])("accepts %s and rejects its alias %s", (canonical, alias) => {
    expect(new IBAN(canonical).isValid).toBeTruthy();
    const aliased = new IBAN(alias, { allowInvalid: true });
    expect(aliased.numeric % MOD97).toBe(1n);
    expect(aliased.isValid).toBeFalsy();
    expect(() => new IBAN(alias)).toThrow(InvalidChecksumDigits);
  });

  // Whitespace (including tabs and padding) is stripped and the value is upper-cased
  // before validation.
  it.each(["de89 3704 0044 0532 0130 00", "DE89\t3704004405320130 00", " de89 370400440532013000 "])(
    "normalises '%s'",
    (raw) => {
      expect(new IBAN(raw).compact).toBe("DE89370400440532013000");
    },
  );

  it("reads the French components", () => {
    const iban = new IBAN("FR1420041010050500013M02606");
    expect(iban.bankCode).toBe("20041");
    expect(iban.branchCode).toBe("01005");
    expect(iban.accountCode).toBe("0500013M026");
    expect(iban.nationalChecksumDigits).toBe("06");
    expect(iban.inSepaZone).toBeTruthy();
  });

  it("reads the Spanish components", () => {
    const iban = new IBAN("ES9121000418450200051332");
    expect(iban.bankCode).toBe("2100");
    expect(iban.branchCode).toBe("0418");
    expect(iban.accountCode).toBe("0200051332");
    expect(iban.nationalChecksumDigits).toBe("45");
  });

  it("reads the British components", () => {
    const iban = new IBAN("GB29NWBK60161331926819");
    expect(iban.bankCode).toBe("NWBK");
    // The British branch code is the sort code.
    expect(iban.branchCode).toBe("601613");
    expect(iban.accountCode).toBe("31926819");
    expect(iban.nationalChecksumDigits).toBe("");
  });

  it("reads the Dutch components", () => {
    const iban = new IBAN("NL91ABNA0417164300");
    expect(iban.bankCode).toBe("ABNA");
    expect(iban.branchCode).toBe("");
    expect(iban.accountCode).toBe("0417164300");
  });

  it("reads the Belgian components", () => {
    const iban = new IBAN("BE68539007547034");
    expect(iban.bankCode).toBe("539");
    expect(iban.accountCode).toBe("0075470");
    expect(iban.nationalChecksumDigits).toBe("34");
  });

  it("reads the Norwegian components", () => {
    const iban = new IBAN("NO9386011117947");
    expect(iban.bankCode).toBe("8601");
    expect(iban.accountCode).toBe("111794");
    expect(iban.nationalChecksumDigits).toBe("7");
    // The trailing block of the formatted form has only three characters.
    expect(iban.formatted).toBe("NO93 8601 1117 947");
  });

  it("reads exotic components", () => {
    // Seychelles: the currency code is part of the BBAN.
    expect(new IBAN("SC18SSCB11010000000000001497USD").currencyCode).toBe("USD");
    // Brazil: account id and account type.
    const brazil = new IBAN("BR9700360305000010009795493P1");
    expect(brazil.accountId).toBe("1");
    expect(brazil.accountType).toBe("P");
    // Guatemala: account type and currency code.
    const guatemala = new IBAN("GT82TRAJ01020000001210029690");
    expect(guatemala.accountType).toBe("02");
    expect(guatemala.currencyCode).toBe("01");
  });

  // Kosovo has an IBAN specification but no ISO 3166-1 entry.
  it("can have an unknown country", () => {
    const iban = new IBAN("XK051212012345678906");
    expect(iban.country).toBeUndefined();
    expect(iban.inSepaZone).toBeFalsy();
  });

  it.each(["DE89370400440532013000", "FR1420041010050500013M02606"])("has a numeric of 1 mod 97 for %s", (code) => {
    expect(new IBAN(code).numeric % MOD97).toBe(1n);
  });

  // Take the valid Italian IBAN and corrupt its national check character (the CIN).
  // Recomputing the IBAN check digits keeps the IBAN itself valid, so only the explicit
  // BBAN validation can notice.
  it("reports an invalid national checksum on request", () => {
    const { bban } = new IBAN("IT60X0542811101000000123456");
    const doctored = IBAN.fromBban("IT", `A${bban.compact.slice(1)}`);
    expect(doctored.isValid).toBeTruthy();
    expect(() => doctored.validate({ validateBban: true })).toThrow(InvalidBBANChecksum);
    expect(() => new IBAN(doctored.compact, { validateBban: true })).toThrow(InvalidBBANChecksum);
  });

  it("accepts BBAN objects in fromBban", () => {
    const iban = IBAN.fromBban("DE", new BBAN("DE", "370400440532013000"));
    expect(iban).toBeInstanceOf(IBAN);
    expect(iban.compact).toBe("DE89370400440532013000");
  });

  it("generates random IBANs without the registry", () => {
    const iban = IBAN.random("FR", { useRegistry: false });
    expect(iban.countryCode).toBe("FR");
    expect(iban.isValid).toBeTruthy();
    expect(iban.validate({ validateBban: true })).toBeTruthy();
  });

  it("generates random IBANs of any country", () => {
    const iban = IBAN.random();
    expect(iban.isValid).toBeTruthy();
    expect(iban.countryCode).toBe(iban.bban.countryCode);
  });

  it("tells aspirational countries apart", () => {
    expect(new IBAN("SN08SN0100152000048500003035").isAspirational).toBeTruthy();
    expect(new IBAN("DE89370400440532013000").isAspirational).toBeFalsy();
    expect(new BBAN("SN", "SN0100152000048500003035").isAspirational).toBeTruthy();
    expect(new BBAN("DE", "370400440532013000").isAspirational).toBeFalsy();
  });
});
