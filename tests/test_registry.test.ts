import { describe, expect, it } from "vitest";
import { BIC } from "../src/bic.ts";
import { algorithms } from "../src/checksum/index.ts";
import { Component } from "../src/domain.ts";
import * as registry from "../src/registry.ts";

describe("bank and IBAN registry", () => {
  it("holds only valid BICs", () => {
    const invalid = registry
      .getAllBanks()
      .flatMap((bank) => (bank.bic ? [bank.bic] : []))
      .filter((bic) => !new BIC(bic, { allowInvalid: true }).isValid);
    expect(invalid).toStrictEqual([]);
  });

  it("reports a missing BIC as null", () => {
    const [bank] = registry.getBanksByCode("CH", "08351");
    expect(bank?.bic).toBeNull();
  });

  it("preserves non-ASCII bank names", () => {
    const names = registry.getBanksByCountry("CZ").map((bank) => bank.name);
    expect(names).toContain("Komerční banka, a.s.");
    expect(names).toContain("Československá obchodní banka, a. s.");
  });

  it("has valid Polish national checksums throughout", () => {
    const algo = algorithms["PL:default"];
    for (const bank of registry.getBanksByCountry("PL")) {
      const { bank_code: code } = bank;
      expect(algo.validate([code.slice(0, 3), code.slice(3, 7)], code[7])).toBeTruthy();
    }
  });

  it("has bank codes matching the country's IBAN spec", () => {
    for (const countryCode of registry.getCountries()) {
      const spec = registry.getIbanSpec(countryCode);
      const lookup = spec.bic_lookup_components.length > 0 ? spec.bic_lookup_components : [Component.BANK_CODE];

      let start = spec.bban_length;
      let end = 0;
      for (const component of lookup) {
        const position = spec.positions[component];
        start = Math.min(start, position.start);
        end = Math.max(end, position.end);
      }

      const mismatched = registry
        .getBanksByCountry(countryCode)
        .filter((bank) => bank.bank_code && bank.bank_code.length !== end - start)
        .map((bank) => bank.bank_code);
      expect(mismatched).toStrictEqual([]);
    }
  });

  it("answers the typed domain queries", () => {
    const countries = registry.getCountries();
    expect(countries).toContain("DE");
    expect(countries).toContain("FR");

    const deSpec = registry.getIbanSpec("DE");
    expect(deSpec.bban_length).toBe(18);
    expect(deSpec.regex).toBeInstanceOf(RegExp);

    expect(registry.getBanksByCountry("DE").length).toBeGreaterThan(0);

    const commerzbank = registry.getBanksByCode("DE", "37040044");
    expect(commerzbank.length).toBeGreaterThan(0);
    expect(commerzbank.some((bank) => bank.name === "Commerzbank")).toBeTruthy();
    // The per-bank checksum method must survive deserialization — dropping it
    // silently skips the German national checksum.
    expect(commerzbank[0].checksum_algo).toBe("13");

    expect(registry.getBanksByBic("DEUTDEDB200").length).toBeGreaterThan(0);
  });

  it("throws for an unknown country code", () => {
    expect(() => registry.getIbanSpec("XX")).toThrow("Unknown country-code 'XX'");
  });

  // The Swiss registry lists foreign-based banks such as Commerzbank, but their BICs are
  // only resolved through the registry of the country the BIC belongs to.
  it("limits a BIC lookup to its country", () => {
    expect(registry.getBanksByCountry("CH").some((bank) => (bank.bic ?? "").startsWith("COBADE"))).toBeTruthy();
    expect(registry.getBanksByBic("COBADEFFXXX").every((bank) => bank.country_code === "DE")).toBeTruthy();
  });

  // The NBB list marks unassigned identification numbers as "VRIJ" or "Onbeschikbaar"
  // with a BIC of "N/A"; those are not banks.
  it.each(["138", "154", "529", "539", "900"])("skips the unassigned Belgian bank code %s", (bankCode) => {
    expect(registry.getBanksByCode("BE", bankCode)).toStrictEqual([]);
  });
});
