import { afterEach, describe, it, expect, vi } from "vitest";
import {
  Algorithm91Variant1,
  Algorithm91Variant2,
  Algorithm91Variant3,
  Algorithm91Variant4,
  digitSum,
  WeightedModulus,
} from "../src/checksum/germany.ts";
import { algorithms } from "../src/checksum/index.ts";
import { InvalidAccountCode, InvalidBBANChecksum } from "../src/exceptions.ts";

describe("German checksum algorithms", () => {
  const successCases: [string, string][] = [
    // Method 02: remainder 0 reconciles to check digit 0.
    ["0000000000", "DE:02"],
    ["0009290701", "DE:00"],
    ["0539290858", "DE:00"],
    ["0001501824", "DE:00"],
    ["0001501832", "DE:00"],
    ["0094012341", "DE:06"],
    ["5073321010", "DE:06"],
    // Method 16 computes like method 06 over positions 1-9 (only method 15 is
    // restricted to positions 6-9), so a valid method-06 account is valid for
    // method 16 too.
    ["0094012341", "DE:16"],
    // Remainder 1 is accepted when the last two digits match.
    ["0000000066", "DE:16"],
    ["0012345008", "DE:10"],
    ["0087654008", "DE:10"],
    // Method 11 maps a computed check digit of 11 to 0.
    ["1000000060", "DE:11"],
    // Remainder 1 would be check digit 10; method 11 maps that to 9.
    ["0000000069", "DE:11"],
    ["0446786040", "DE:17"],
    ["0240334000", "DE:19"],
    ["0200520016", "DE:19"],
    ["0000138301", "DE:24"],
    ["1306118605", "DE:24"],
    ["3307118608", "DE:24"],
    ["9307118603", "DE:24"],
    ["0521382181", "DE:25"],
    ["0520309001", "DE:26"],
    ["1111118111", "DE:26"],
    ["0005501024", "DE:26"],
    ["0009141405", "DE:32"],
    ["1709107983", "DE:32"],
    ["0122116979", "DE:32"],
    ["0121114867", "DE:32"],
    ["9030101192", "DE:32"],
    ["9245500460", "DE:32"],
    ["9913000700", "DE:34"],
    ["9914001000", "DE:34"],
    ["0000191919", "DE:38"],
    ["0001100660", "DE:38"],
    ["2063099200", "DE:61"],
    ["0260760481", "DE:61"],
    ["0123456600", "DE:63"],
    // The sub-account "00" may be omitted, moving the check digit to position 10.
    ["0001234566", "DE:63"],
    ["1234567893", "DE:21"],
    ["1234567895", "DE:22"],
    ["8889654328", "DE:68"],
    ["0987654324", "DE:68"],
    ["0987654328", "DE:68"],
    // Accounts in [400000000, 499999999] skip the check digit.
    ["0400000000", "DE:68"],
    ["0006543200", "DE:76"],
    ["9012345600", "DE:76"],
    ["7876543100", "DE:76"],
    ["0002525259", "DE:88"],
    ["0001000500", "DE:88"],
    ["0090013000", "DE:88"],
    ["0092525253", "DE:88"],
    ["0099913003", "DE:88"],
    ["2974118000", "DE:91"],
    ["5281741000", "DE:91"],
    ["9952810000", "DE:91"],
    ["2974117000", "DE:91"],
    ["5281770000", "DE:91"],
    ["9952812000", "DE:91"],
    ["8840019000", "DE:91"],
    ["8840050000", "DE:91"],
    ["8840087000", "DE:91"],
    ["8840045000", "DE:91"],
    ["8840012000", "DE:91"],
    ["8840055000", "DE:91"],
    ["8840080000", "DE:91"],
    ["0068007003", "DE:95"],
    ["0847321750", "DE:95"],
    ["6450060494", "DE:95"],
    ["6454000003", "DE:95"],
    // Method 95 has no check digit for these account ranges.
    ["0000000001", "DE:95"],
    ["0001999999", "DE:95"],
    ["0009000000", "DE:95"],
    ["0025999999", "DE:95"],
    ["0396000000", "DE:95"],
    ["0499999999", "DE:95"],
    ["0700000000", "DE:95"],
    ["0799999999", "DE:95"],
    ["0910000000", "DE:95"],
    ["0989999999", "DE:95"],
    ["0068007003", "DE:99"],
    ["0847321750", "DE:99"],
    ["0396000000", "DE:99"],
    ["0499999999", "DE:99"],
    ["3456789019", "DE:A2"],
    ["5678901231", "DE:A2"],
    ["6789012348", "DE:A2"],
    ["3456789012", "DE:A2"],
    ["1234567897", "DE:A3"],
    ["0123456782", "DE:A3"],
    ["9876543210", "DE:A3"],
    ["1234567890", "DE:A3"],
    ["0123456789", "DE:A3"],
    // Method 99 accepts the whole range 0396000000 to 0499999999 without a check.
    ["0396000001", "DE:99"],
    ["0412345678", "DE:99"],
    // Method 08 applies no check digit below account number 60000, so an
    // account in [6000, 60000) is valid regardless of its check digit.
    ["0000006000", "DE:08"],
    ["0000059999", "DE:08"],
  ];

  it.each(successCases)("validates %s with algorithm %s", (accountCode, algoName) => {
    expect(algorithms[algoName].validate([accountCode], "")).toBeTruthy();
  });

  const failureCases: [string, string][] = [
    ["8840017000", "DE:91"],
    ["8840023000", "DE:91"],
    ["8840041000", "DE:91"],
    ["8840014000", "DE:91"],
    ["8840026000", "DE:91"],
    ["8840011000", "DE:91"],
    ["8840025000", "DE:91"],
    ["8840062000", "DE:91"],
    ["8840010000", "DE:91"],
    ["8840057000", "DE:91"],
    // From account number 60000 upward method 08 does apply the check, so a
    // wrong check digit must still be rejected.
    ["0000060000", "DE:08"],
    // Method 02 with a non-zero, non-one remainder: the computed digit is 9.
    ["0000000010", "DE:02"],
    // Remainder 1 and a second digit outside {8, 9} is rejected.
    ["0000000060", "DE:25"],
    // Method 63 only accepts a leading zero.
    ["1123456600", "DE:63"],
    // Without the sub-account the check digit at position 10 still has to match.
    ["0001234567", "DE:63"],
    // Method 76 only accepts leading digits 0, 4, 6, 7, 8 and 9.
    ["1234567890", "DE:76"],
    ["1234567890", "DE:A2"],
    ["0123456789", "DE:A2"],
    ["6543217890", "DE:A3"],
    ["0543216789", "DE:A3"],
    // Just outside the exception range of method 99 the check digit applies again.
    ["0395999999", "DE:99"],
    ["0500000000", "DE:99"],
    // Method 95 test account numbers with a wrong check digit.
    ["0068007004", "DE:95"],
    ["6454000004", "DE:95"],
    // Just outside the exception ranges of method 95 the check digit applies.
    ["0002000000", "DE:95"],
    ["0008999999", "DE:95"],
    ["0026000000", "DE:95"],
    ["0395999999", "DE:95"],
    ["0500000000", "DE:95"],
    ["0699999999", "DE:95"],
    ["0800000000", "DE:95"],
    ["0909999999", "DE:95"],
    ["0990000001", "DE:95"],
  ];

  it.each(failureCases)("rejects %s with algorithm %s", (accountCode, algoName) => {
    expect(algorithms[algoName].validate([accountCode], "")).toBeFalsy();
  });
});

describe("Belgium checksum", () => {
  it("validates correctly", () => {
    expect(algorithms["BE:default"].validate(["539", "0075470"], "34")).toBeTruthy();
  });

  it("rejects invalid", () => {
    expect(algorithms["BE:default"].validate(["050", "0001234"], "56")).toBeFalsy();
  });

  it("handles edge case mod 97 = 0", () => {
    expect(algorithms["BE:default"].validate(["050", "0000177"], "97")).toBeTruthy();
  });
});

describe("Norway checksum", () => {
  it("handles edge case mod 11 = 0", () => {
    expect(algorithms["NO:default"].validate(["6042", "143964"], "0")).toBeTruthy();
  });
});

describe("Norway checksum invalid check digit", () => {
  it("rejects an account code without a valid check digit", () => {
    expect(() => algorithms["NO:default"].validate(["6042", "100007"], "")).toThrow(InvalidAccountCode);
  });
});

describe("German checksum helpers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("solves method 68", () => {
    const algo = algorithms["DE:68"];
    expect(algo.solve(["1234567890"])).toStrictEqual(["1239567892"]);
    expect(algo.validate(["1239567892"], "")).toBeTruthy();

    expect(algo.solve(["0987654321"])).toStrictEqual(["0987654324"]);
    expect(algo.validate(["0987654324"], "")).toBeTruthy();
  });

  it("computes the digit sum above 99", () => {
    expect(digitSum(199)).toBe(19);
  });

  it("rejects an invalid remainder with method 02", () => {
    expect(() => algorithms["DE:02"].validate(["0000000060"], "")).toThrow(InvalidBBANChecksum);
  });

  it("skips small accounts with method 08", () => {
    expect(algorithms["DE:08"].compute(["0000001000"])).toBe("");
  });

  it("has no check digit with method 09", () => {
    expect(algorithms["DE:09"].compute(["0000000000"])).toBe("");
  });

  // The check digit is not the leading position, so no candidate can satisfy
  // method 63 and the shared solver gives up.
  it("exhausts the shared solver for method 63", () => {
    const algo = algorithms["DE:63"];
    expect(algo).toBeInstanceOf(WeightedModulus);
    expect(WeightedModulus.prototype.solve.call(algo, ["1123456789"])).toBeNull();
  });

  it("computes and solves method 91", () => {
    const algo = algorithms["DE:91"];
    expect(algo.compute(["2974118000"])).toBe("8");
    expect(algo.solve(["2974118000"])).toStrictEqual(["2974118000"]);
  });

  // Variant 1 (method 00) can always place a check digit, so it is used for both.
  it.each(["DE:A2", "DE:A3"])("computes and solves the fallback variants of %s", (algorithmName) => {
    const algo = algorithms[algorithmName];
    expect(algo.compute(["3456789010"])).toBe("9");
    expect(algo.solve(["3456789010"])).toStrictEqual(["3456789019"]);
  });

  // Each variant can always place a check digit, so the "none of them worked"
  // result is only reached when every variant declines.
  it("gives up on method 91 when every variant declines", () => {
    for (const variant of [Algorithm91Variant1, Algorithm91Variant2, Algorithm91Variant3, Algorithm91Variant4]) {
      vi.spyOn(variant.prototype, "solve").mockReturnValue(null);
    }
    expect(algorithms["DE:91"].solve(["2974118000"])).toBeNull();
  });
});
