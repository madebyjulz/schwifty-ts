import { afterEach, describe, expect, it, vi } from "vitest";
import { BBAN } from "../src/bban.ts";
import { GenerateRandomOverflowError, InvalidBBANChecksum } from "../src/exceptions.ts";

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
  it("throws once the retries are exhausted", () => {
    vi.spyOn(BBAN.prototype, "validateNationalChecksum").mockImplementation(() => {
      throw new InvalidBBANChecksum("Invalid national checksum");
    });
    expect(() => BBAN.random("DE")).toThrow(GenerateRandomOverflowError);
  });
});
