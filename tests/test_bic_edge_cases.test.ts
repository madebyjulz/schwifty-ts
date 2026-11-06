import { describe, expect, it } from "vitest";
import { BIC } from "../src/bic.ts";
import { InvalidLength, InvalidStructure } from "../src/exceptions.ts";

describe("BIC edge cases", () => {
  // The constructor strips whitespace and upper-cases the value.
  it("normalises its input", () => {
    expect(new BIC("genodem1gls").compact).toBe("GENODEM1GLS");
    expect(new BIC("GENO DE M1 GLS").compact).toBe("GENODEM1GLS");
  });

  it.each(["GENODEM1GL", "GENODEM1GLSX", "GENODEM", ""])("rejects the length of '%s'", (code) => {
    expect(() => new BIC(code)).toThrow(InvalidLength);
  });

  // Digits in the business party prefix are fine under ISO 9362:2022 but rejected when
  // strict SWIFT compliance is enforced.
  it("enforces SWIFT compliance for eight-character codes", () => {
    expect(new BIC("1234DEWW").compact).toBe("1234DEWW");
    expect(() => new BIC("1234DEWW", { enforceSwiftCompliance: true })).toThrow(InvalidStructure);
  });

  it("lists the candidates of a bank code", () => {
    const candidates = BIC.candidatesFromBankCode("FR", "30004");
    // BNPAFRPP and the equivalent BNPAFRPPXXX are listed once.
    expect(candidates).toHaveLength(22);
    expect(candidates.map((candidate) => candidate.compact)).not.toContain("BNPAFRPPXXX");
    // Candidates are sorted by rank, so the first one is the BIC that `fromBankCode` picks.
    expect(candidates[0].compact).toBe("BNPAFRPP");
    expect(BIC.fromBankCode("FR", "30004").compact).toBe("BNPAFRPP");
  });

  it("reports type and format of an eight-character code", () => {
    const bic = new BIC("GENODEM0");
    expect(bic.type).toBe("testing");
    expect(bic.branchCode).toBe("");
    expect(bic.formatted).toBe("GENO DE M0");
  });
});
