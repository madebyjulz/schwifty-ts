import { afterEach, describe, it, expect, vi } from "vitest";
import { BIC } from "../src/bic.ts";
import type { Bank } from "../src/domain.ts";
import { InvalidLength, InvalidStructure, InvalidCountryCode, InvalidBankCode } from "../src/exceptions.ts";
import * as registry from "../src/registry.ts";

function makeBank(fields: Pick<Bank, "bank_code" | "bic" | "name"> & Partial<Bank>): Bank {
  return { checksum_algo: "", country_code: "DE", primary: false, short_name: null, ...fields };
}

describe(BIC, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("validates a BIC", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.formatted).toBe("GENO DE M1 GLS");
    expect(bic.validate()).toBeTruthy();
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
    expect(bic).toHaveLength(11);
    expect(bic.bankCode).toBe("GENO");
    expect(bic.countryCode).toBe("DE");
    expect(bic.locationCode).toBe("M1");
    expect(bic.branchCode).toBe("GLS");
    expect(bic.domesticBankCodes).toStrictEqual(["43060967", "43060988"]);
    expect(bic.bankNames).toStrictEqual(["GLS Gemeinschaftsbank", "GLS Gemeinschaftsbank (GAA)"]);
    expect(bic.bankShortNames).toStrictEqual(["GLS Bank in Bochum (GAA)", "GLS Gemeinschaftsbk Bochum"]);
    expect(bic.country).toBeDefined();
    expect(bic.exists).toBeTruthy();
    expect(bic.type).toBe("passive");
  });

  it("handles unknown BIC", () => {
    const bic = new BIC("ABNAJPJTXXX");
    expect(bic).toHaveLength(11);
    expect(bic.bankCode).toBe("ABNA");
    expect(bic.countryCode).toBe("JP");
    expect(bic.locationCode).toBe("JT");
    expect(bic.branchCode).toBe("XXX");
    expect(bic.domesticBankCodes).toStrictEqual([]);
    expect(bic.bankNames).toStrictEqual([]);
    expect(bic.bankShortNames).toStrictEqual([]);
    expect(bic.exists).toBeFalsy();
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

  it("falls back to the institution when a BIC with branch code has no entry", () => {
    // Some registries only list the 8-character institution BIC. An extended
    // 11-character BIC denotes a branch of that same institution, so it should
    // still resolve to the institution's data rather than returning nothing.
    const institution = new BIC("BSABESBB");
    expect(institution.domesticBankCodes.length).toBeGreaterThan(0);
    for (const extended of ["BSABESBBXXX", "BSABESBB001"]) {
      const bic = new BIC(extended);
      expect(bic.branchCode).toBeTruthy();
      expect(bic.domesticBankCodes).toStrictEqual(institution.domesticBankCodes);
      expect(bic.bankNames).toStrictEqual(institution.bankNames);
      expect(bic.bankShortNames).toStrictEqual(institution.bankShortNames);
    }
  });

  it("prefers a branch-specific registry entry over the institution fallback", () => {
    expect(new BIC("MARKDEF1100").domesticBankCodes).toStrictEqual(["10000000"]);
    expect(new BIC("GENODEM1GLS").domesticBankCodes).toStrictEqual(["43060967", "43060988"]);
  });

  it("resolves ORO PAY (CY)", () => {
    const bic = new BIC("OROACY2LXXX");
    expect(bic.bankNames).toStrictEqual(["ORO PAY LTD"]);
    expect(bic.bankShortNames).toStrictEqual(["ORO PAY"]);
    expect(bic.countryCode).toBe("CY");
  });

  it.each(["COBADEFF", "DEUTDEFF"])("falls back to the XXX entry for %s", (code) => {
    const bic = new BIC(code);
    const xxxEntry = new BIC(`${code}XXX`);
    expect(xxxEntry.domesticBankCodes.length).toBeGreaterThan(0);
    expect(xxxEntry.bankNames.length).toBeGreaterThan(0);
    expect(xxxEntry.bankShortNames.length).toBeGreaterThan(0);
    expect(bic.domesticBankCodes).toStrictEqual(xxxEntry.domesticBankCodes);
    expect(bic.bankNames).toStrictEqual(xxxEntry.bankNames);
    expect(bic.bankShortNames).toStrictEqual(xxxEntry.bankShortNames);
    expect(bic.exists).toBeFalsy();
    expect(xxxEntry.exists).toBeTruthy();
  });

  it("prefers an exact 8-character entry over the XXX fallback", () => {
    const entries: Record<string, Bank[]> = {
      TESTDEFF: [makeBank({ bic: "TESTDEFF", bank_code: "10000000", name: "Exact institution" })],
      TESTDEFFXXX: [makeBank({ bic: "TESTDEFFXXX", bank_code: "20000000", name: "XXX entry", short_name: "XXX" })],
    };
    vi.spyOn(registry, "getBanksByBic").mockImplementation((code) => entries[code] ?? []);
    const bic = new BIC("TESTDEFF");
    expect(bic.domesticBankCodes).toStrictEqual(["10000000"]);
    expect(bic.bankNames).toStrictEqual(["Exact institution"]);
    expect(bic.bankShortNames).toStrictEqual([]);
  });

  it.each(["MARKDEF1", "ABNAJPJT", "COBADEF"])(
    "returns nothing without an institution or XXX record for %s",
    (code) => {
      const bic = new BIC(code, { allowInvalid: true });
      expect(bic.domesticBankCodes).toStrictEqual([]);
      expect(bic.bankNames).toStrictEqual([]);
      expect(bic.bankShortNames).toStrictEqual([]);
      expect(bic.exists).toBeFalsy();
    },
  );

  it("raises when every registry entry for a bank code lacks a BIC", () => {
    // BE 102 is listed in the registry but carries no BIC; Python surfaces this
    // as InvalidBankCode via the IndexError on the empty candidate list.
    expect(BIC.candidatesFromBankCode("BE", "102")).toStrictEqual([]);
    expect(() => BIC.fromBankCode("BE", "102")).toThrow(InvalidBankCode);
  });

  it("enforces SWIFT compliance", () => {
    expect(() => new BIC("1234DEWWXXX", { enforceSwiftCompliance: true })).toThrow(InvalidStructure);
  });

  const invalidCases: [string, new (message?: string) => Error][] = [
    ["AAAA", InvalidLength],
    ["AAAADEM1GLSX", InvalidLength],
    ["GENOD1M1GLS", InvalidStructure],
    ["GENODEM1@#%", InvalidStructure],
    ["GENOXXM1GLS", InvalidCountryCode],
  ];

  it.each(invalidCases)("rejects invalid BIC %s", (code, exc) => {
    expect(() => new BIC(code)).toThrow(exc);
  });

  // An 11-character BIC whose branch code (positions 9-11) contains
  // non-alphanumeric characters must be rejected. When the structure check only
  // anchors the start of the string, the branch-code group being optional lets
  // the trailing garbage slip through and even exposes it via `BIC.branchCode`.
  const invalidBranchCodes = [
    "GENODEM1@#%", // symbols in the branch code
    "GENODEM1G-S", // dash in the branch code
    "GENODEM1GL*", // star in the branch code
    "MARKDEF1$$$", // dollar signs in the branch code
    "GENODEM1..X", // dots in the branch code
  ];

  it.each(invalidBranchCodes)("rejects non-alphanumeric branch code in %s", (code) => {
    expect(() => new BIC(code)).toThrow(InvalidStructure);
    expect(() => new BIC(code, { enforceSwiftCompliance: true })).toThrow(InvalidStructure);
    expect(new BIC(code, { allowInvalid: true }).isValid).toBeFalsy();
  });

  // Regression guard for the full-string structure validation: genuinely valid
  // 8- and 11-character BICs must keep validating.
  it.each(["GENODEM1", "GENODEM1GLS", "MARKDEF1100", "1234DEWWXXX"])("validates %s over the full string", (code) => {
    expect(new BIC(code).validate()).toBeTruthy();
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
    ["FR", "18719", "BFCORERXXXX"], // head office, not the Mayotte branch
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
    ["SI", "02188", "LJBASI2XXXX"],
    ["SI", "03100", "KBMASI2XXXX"], // retired SKB code, alias of OTP banka
    ["SK", "0900", "GIBASKBX"],
  ];

  it.each(fromBankCodeCases)("from_bank_code(%s, %s) = %s", (country, bankCode, expected) => {
    expect(BIC.fromBankCode(country, bankCode).compact).toBe(expected);
  });

  it("throws for unknown bank code", () => {
    expect(() => BIC.fromBankCode("PO", "12345678")).toThrow(InvalidBankCode);
  });

  it("picks primary BIC", () => {
    expect(BIC.fromBankCode("DE", "20070024").compact).toBe("DEUTDEDBHAM");
  });

  // Bank code 18719 has two 'XXX' BICs; the registry marks the head office primary and the
  // Mayotte branch not. The primary must win over the alphabetical tie-break.
  it("prefers the registry primary among generic codes", () => {
    expect(BIC.fromBankCode("FR", "18719").compact).toBe("BFCORERXXXX");
    expect(BIC.candidatesFromBankCode("FR", "18719").map((b) => b.compact)).toStrictEqual([
      "BFCORERXXXX",
      "BFCOYTYTXXX",
    ]);
    // The primary record, not the secondary LAMPDEDDXXX.
    expect(BIC.fromBankCode("DE", "48020151").compact).toBe("HAUKDEFFXXX");
  });

  it("magic methods", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.equals("GENODEM1GLS")).toBeTruthy();
    expect(bic.equals(new BIC("GENODEM1GLS"))).toBeTruthy();
    expect(bic.equals(new BIC("GENODEMMXXX"))).toBeFalsy();
    expect(bic.lessThan("GENODEM1GLT")).toBeTruthy();
    expect(String(bic)).toBe("GENODEM1GLS");
    expect(bic.repr()).toBe("<BIC=GENODEM1GLS>");
  });
});
