import { describe, it, expect } from "vitest";
import { BIC } from "../src/bic.ts";
import {
  InvalidLength,
  InvalidStructure,
  InvalidCountryCode,
  InvalidBankCode,
} from "../src/exceptions.ts";

describe("BIC", () => {
  it("validates a BIC", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.formatted).toBe("GENO DE M1 GLS");
    expect(bic.validate()).toBe(true);
  });

  it("allows invalid BIC with flag", () => {
    const bic = new BIC("GENODXM1GLS", { allowInvalid: true });
    expect(bic.compact).toBe("GENODXM1GLS");
    expect(bic.countryCode).toBe("DX");
    expect(() => bic.validate()).toThrow(InvalidCountryCode);
  });

  it("handles BIC with no branch code", () => {
    const bic = new BIC("GENODEM1");
    expect(bic.branchCode).toBe("");
    expect(bic.formatted).toBe("GENO DE M1");
  });

  it("has correct properties", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.length).toBe(11);
    expect(bic.bankCode).toBe("GENO");
    expect(bic.countryCode).toBe("DE");
    expect(bic.locationCode).toBe("M1");
    expect(bic.branchCode).toBe("GLS");
    expect(bic.domesticBankCodes).toEqual(["43060967", "43060988"]);
    expect(bic.bankNames).toEqual([
      "GLS Gemeinschaftsbank",
      "GLS Gemeinschaftsbank (GAA)",
    ]);
    expect(bic.bankShortNames).toEqual([
      "GLS Bank in Bochum (GAA)",
      "GLS Gemeinschaftsbk Bochum",
    ]);
    expect(bic.country).toBeDefined();
    expect(bic.exists).toBe(true);
    expect(bic.type).toBe("passive");
  });

  it("handles unknown BIC", () => {
    const bic = new BIC("ABNAJPJTXXX");
    expect(bic.length).toBe(11);
    expect(bic.bankCode).toBe("ABNA");
    expect(bic.countryCode).toBe("JP");
    expect(bic.locationCode).toBe("JT");
    expect(bic.branchCode).toBe("XXX");
    expect(bic.domesticBankCodes).toEqual([]);
    expect(bic.bankNames).toEqual([]);
    expect(bic.bankShortNames).toEqual([]);
    expect(bic.exists).toBe(false);
    expect(bic.type).toBe("default");
  });

  const typeTests: [string, string][] = [
    ["GENODEM0GLS", "testing"],
    ["GENODEM1GLS", "passive"],
    ["GENODEM2GLS", "reverse billing"],
    ["GENODEMMGLS", "default"],
    ["1234DEWWXXX", "default"],
  ];

  it.each(typeTests)("type of %s is %s", (code, type) => {
    expect(new BIC(code).type).toBe(type);
  });

  it("enforces SWIFT compliance", () => {
    expect(
      () => new BIC("1234DEWWXXX", { enforceSwiftCompliance: true }),
    ).toThrow(InvalidStructure);
  });

  const invalidCases: [string, new (...args: any[]) => Error][] = [
    ["AAAA", InvalidLength],
    ["AAAADEM1GLSX", InvalidLength],
    ["GENOD1M1GLS", InvalidStructure],
    ["GENOXXM1GLS", InvalidCountryCode],
  ];

  it.each(invalidCases)("rejects invalid BIC %s", (code, exc) => {
    expect(() => new BIC(code)).toThrow(exc);
  });

  const fromBankCodeCases: [string, string, string][] = [
    ["AT", "36274", "RZTIAT22274"],
    ["BE", "002", "GEBABEBB"],
    ["CH", "00777", "KBSZCH22XXX"],
    ["CH", "08390", "ABSOCH22XXX"],
    ["CZ", "0600", "AGBACZPP"],
    ["DE", "43060967", "GENODEM1GLS"],
    ["ES", "0209", "BSABESBB"],
    ["FI", "101", "NDEAFIHH"],
    ["FR", "30004", "BNPAFRPP"],
    ["FR", "30066", "CMCIFRPPXXX"],
    ["FR", "17469", "SOCBPFTXXXX"],
    ["FR", "10096", "CMCIFRPP"],
    ["FR", "18719", "BFCOYTYTXXX"],
    ["FR", "30077", "SMCTFR2A"],
    ["FR", "13489", "NORDFRPP"],
    ["HU", "107", "CIBHHUHB"],
    ["HR", "2485003", "CROAHR2X"],
    ["IT", "01015", "SARDIT31"],
    ["IT", "01030", "PASCITMM"],
    ["LV", "RIKO", "RIKOLV2XXXX"],
    ["MC", "30003", "SOGEMCM1"],
    ["NL", "ADYB", "ADYBNL2A"],
    ["PL", "10100055", "NBPLPLPWXXX"],
    ["PL", "10900004", "WBKPPLPPXXX"],
    ["RO", "BPOS", "BPOSROBU"],
    ["SE", "500", "ESSESESS"],
    ["SI", "01050", "BSLJSI2XFNB"],
    ["SK", "0900", "GIBASKBX"],
  ];

  it.each(fromBankCodeCases)(
    "from_bank_code(%s, %s) = %s",
    (country, bankCode, expected) => {
      expect(BIC.fromBankCode(country, bankCode).compact).toBe(expected);
    },
  );

  it("throws for unknown bank code", () => {
    expect(() => BIC.fromBankCode("PO", "12345678")).toThrow(InvalidBankCode);
  });

  it("picks primary BIC", () => {
    expect(BIC.fromBankCode("DE", "20070024").compact).toBe("DEUTDEDBHAM");
  });

  it("magic methods", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.equals("GENODEM1GLS")).toBe(true);
    expect(bic.equals(new BIC("GENODEM1GLS"))).toBe(true);
    expect(bic.equals(new BIC("GENODEMMXXX"))).toBe(false);
    expect(bic.lessThan("GENODEM1GLT")).toBe(true);
    expect(String(bic)).toBe("GENODEM1GLS");
    expect(bic.repr()).toBe("<BIC=GENODEM1GLS>");
  });
});
