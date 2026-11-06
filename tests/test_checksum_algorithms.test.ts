import { describe, expect, it } from "vitest";
import { algorithms, iso7064, luhn, numerify, weighted } from "../src/checksum/index.ts";
import { DefaultAlgorithm as DutchAlgorithm } from "../src/checksum/netherlands.ts";
import { Component } from "../src/domain.ts";

describe("checksum helpers", () => {
  it("numerifies", () => {
    expect(numerify("0")).toBe(0n);
    expect(numerify("9")).toBe(9n);
    // Letters map to their position in the digit+uppercase alphabet (A -> 10).
    expect(numerify("A")).toBe(10n);
    expect(numerify("Z9")).toBe(359n);
    expect(numerify("DE89")).toBe(131_489n);
  });

  it("computes a weighted sum", () => {
    expect(weighted("123", 10, [1, 2, 3])).toBe(4);
    // Surplus digits are ignored, like with `zip`.
    expect(weighted("12345", 10, [1, 1])).toBe(3);
  });

  it("computes luhn", () => {
    expect(luhn("7992739871")).toBe("3");
    expect(luhn("12345600007")).toBe("4");
  });

  it("computes ISO 7064", () => {
    expect(iso7064(12_345n, 97n, (r) => 98n - r)).toBe("72");
    expect(iso7064(100n, 11n, (r) => r, 1)).toBe("1");
  });
});

describe("national checksum algorithms", () => {
  it("registers the expected non-German algorithms", () => {
    const registered = new Set(
      Object.keys(algorithms)
        .filter((key) => !key.startsWith("DE"))
        .map((key) => key.split(":")[0]),
    );
    expect(registered).toStrictEqual(
      new Set([
        "BA",
        "BE",
        "CZ",
        "EE",
        "ES",
        "FI",
        "FR",
        "IS",
        "IT",
        "MC",
        "ME",
        "MK",
        "MR",
        "NO",
        "PL",
        "PT",
        "RS",
        "SI",
        "SK",
        "SM",
        "TL",
        "TN",
        "XK",
      ]),
    );
    // Germany only registers named methods, and the Dutch algorithm is deliberately not
    // registered anymore.
    expect(algorithms["DE:default"]).toBeUndefined();
    expect(algorithms["NL:default"]).toBeUndefined();
  });

  it("computes the French checksum", () => {
    const algo = algorithms["FR:default"];
    const components = ["20041", "01005", "0500013M026"];
    expect(algo.compute(components)).toBe("06");
    expect(algo.validate(components, "06")).toBeTruthy();
    expect(algo.validate(components, "07")).toBeFalsy();
  });

  it("uses the French checksum for Monaco", () => {
    expect(algorithms["MC:default"].compute(["20041", "01005", "0500013M026"])).toBe("06");
  });

  it("computes the Spanish checksum", () => {
    const algo = algorithms["ES:default"];
    const components = ["2100", "0418", "0200051332"];
    expect(algo.compute(components)).toBe("45");
    expect(algo.validate(components, "45")).toBeTruthy();
    expect(algo.validate(components, "46")).toBeFalsy();
  });

  // A weighted remainder of 0 yields 11 - 0 = 11, which the Spanish algorithm reconciles
  // to the check digit 0.
  it("reconciles Spanish edge values", () => {
    expect(algorithms["ES:default"].compute(["0000", "0000", "0000000000"])).toBe("00");
  });

  it("computes the Italian checksum", () => {
    const algo = algorithms["IT:default"];
    const components = ["05428", "11101", "000000123456"];
    expect(algo.compute(components)).toBe("X");
    expect(algo.validate(components, "X")).toBeTruthy();
    expect(algo.validate(components, "A")).toBeFalsy();
  });

  it("uses the Italian checksum for San Marino", () => {
    expect(algorithms["SM:default"].compute(["03225", "09800", "000000270100"])).toBe("U");
  });

  it("computes the Czech checksum", () => {
    const algo = algorithms["CZ:default"];
    expect(algo.accepts).toStrictEqual([Component.BRANCH_CODE, Component.ACCOUNT_CODE]);
    // The Czech algorithm has no dedicated check digit: validity means both the branch
    // and the account code weigh to 0 modulo 11.
    expect(algo.compute(["000019", "2000145399"])).toBe("");
    expect(algo.validate(["000019", "2000145399"], "")).toBeTruthy();
    expect(algo.validate(["000019", "2000145390"], "")).toBeFalsy();
  });

  it("repairs the trailing Czech digit when solving", () => {
    const algo = algorithms["CZ:default"];
    expect(algo.solve(["000019", "2000145390"])).toStrictEqual(["000019", "2000145399"]);
    expect(algo.solve(["000019", "2000145399"])).toStrictEqual(["000019", "2000145399"]);
  });

  it("uses the Czech checksum for Slovakia", () => {
    expect(algorithms["SK:default"].validate(["000019", "8742637541"], "")).toBeTruthy();
  });

  it("computes the Estonian checksum", () => {
    const algo = algorithms["EE:default"];
    const components = ["00", "22102014568"];
    expect(algo.compute(components)).toBe("5");
    expect(algo.validate(components, "5")).toBeTruthy();
    expect(algo.validate(components, "6")).toBeFalsy();
  });

  it("computes the Finnish checksum", () => {
    const algo = algorithms["FI:default"];
    const components = ["123", "4560000078"];
    expect(algo.compute(components)).toBe("5");
    expect(algo.validate(components, "5")).toBeTruthy();
    expect(algo.validate(components, "6")).toBeFalsy();
  });

  it("computes the Icelandic checksum", () => {
    const algo = algorithms["IS:default"];
    expect(algo.accepts).toStrictEqual([Component.ACCOUNT_HOLDER_ID]);
    // The check digit lives inside the account holder id at index 8.
    expect(algo.compute(["5510730339"])).toBe("3");
    expect(algo.validate(["5510730339"], "")).toBeTruthy();
    expect(algo.validate(["5510730349"], "")).toBeFalsy();
  });

  it("solves the Icelandic checksum", () => {
    expect(algorithms["IS:default"].solve(["5510730309"])).toStrictEqual(["5510730339"]);
  });

  // This holder id would require the check digit 10, which no single digit can supply,
  // so it can never validate and cannot be solved.
  it("cannot solve an impossible Icelandic holder id", () => {
    const algo = algorithms["IS:default"];
    expect(algo.compute(["0000000600"])).toBe("10");
    expect(algo.validate(["0000000600"], "")).toBeFalsy();
    expect(algo.solve(["0000000600"])).toBeNull();
  });

  it("computes the Polish checksum", () => {
    const algo = algorithms["PL:default"];
    expect(algo.accepts).toStrictEqual([Component.BANK_CODE, Component.BRANCH_CODE]);
    expect(algo.compute(["109", "0101"])).toBe("4");
    expect(algo.compute(["114", "0101"])).toBe("0");
    expect(algo.validate(["109", "0101"], "4")).toBeTruthy();
    expect(algo.validate(["109", "0101"], "5")).toBeFalsy();
  });

  // These countries share the plain ISO 7064 mod-97-10 algorithm, fed with the Portuguese
  // example BBAN (without its check digits).
  it.each(["BA", "ME", "MK", "PT", "RS", "SI", "TL"])("computes the ISO 7064 group checksum for %s", (countryCode) => {
    const algo = algorithms[`${countryCode}:default`];
    expect(algo.compute(["0002012312345678901"])).toBe("54");
    expect(algo.validate(["0002012312345678901"], "54")).toBeTruthy();
    expect(algo.validate(["0002012312345678901"], "55")).toBeFalsy();
  });

  it("computes the Bosnian checksum", () => {
    expect(algorithms["BA:default"].compute(["12900794010284"])).toBe("94");
  });

  // MR and TN use the 97 - r post-processing variant of ISO 7064.
  it("computes the Mauritanian and Tunisian variant", () => {
    expect(algorithms["MR:default"].compute(["00020", "00101", "00001234567"])).toBe("53");
    expect(algorithms["TN:default"].compute(["10", "006", "0351835984788"])).toBe("31");
  });

  // The Dutch eleven-test is kept in the codebase but no longer registered, because it is
  // not used for Dutch IBANs anymore.
  it("keeps the Dutch checksum available but unregistered", () => {
    const algo = new DutchAlgorithm();
    expect(algo.compute(["0417164300"])).toBe("");
    expect(algo.validate(["0417164300"], "")).toBeTruthy();
    expect(algo.validate(["0417164301"], "")).toBeFalsy();
  });

  // Algorithms whose checksum occupies its own BBAN field have nothing to adjust; the
  // inherited `solve` is a pass-through.
  it("returns the components unchanged in the base solve", () => {
    const spanish = ["2100", "0418", "0200051332"];
    const french = ["20041", "01005", "0500013M026"];
    expect(algorithms["ES:default"].solve(spanish)).toStrictEqual(spanish);
    expect(algorithms["FR:default"].solve(french)).toStrictEqual(french);
  });
});
