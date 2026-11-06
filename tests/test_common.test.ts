import { describe, expect, it } from "vitest";
import { BIC } from "../src/bic.ts";
import { clean, toAscii } from "../src/common.ts";
import { InvalidStructure } from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";

const FULLWIDTH_DE89 = "ＤＥ８９";
const EURO_SIGN = "€";
const GRINNING_FACE = "\u{1F600}";
const NO_BREAK_SPACE = " ";

describe("ASCII sanitisation", () => {
  it("folds compatibility forms onto their ASCII equivalents", () => {
    expect(clean(`${FULLWIDTH_DE89} 3704 0044 0532 0130 00`)).toBe("DE89370400440532013000");
    expect(toAscii("café")).toBe("cafe");
  });

  it("strips unicode whitespace", () => {
    expect(clean(`DE89${NO_BREAK_SPACE}3704 0044 0532 0130 00`)).toBe("DE89370400440532013000");
  });

  it("accepts a full-width IBAN through the public API", () => {
    expect(new IBAN(`${FULLWIDTH_DE89} 3704 0044 0532 0130 00`).compact).toBe("DE89370400440532013000");
  });

  it("rejects characters with no ASCII equivalent instead of dropping them", () => {
    expect(() => new IBAN(`DE89370400440532013000${EURO_SIGN}`)).toThrow(InvalidStructure);
  });

  it("rejects non-ASCII even when validation is skipped", () => {
    expect(() => new IBAN(`DE8937040044053201300${GRINNING_FACE}`, { allowInvalid: true })).toThrow(InvalidStructure);
  });
});

describe(clean, () => {
  it.each([
    ["DE89 3704", "DE893704"],
    ["a b\tc\nd", "ABCD"],
    ["  x  ", "X"],
    ["", ""],
    ["already", "ALREADY"],
    // Non-breaking spaces count as whitespace, too.
    ["a\u00A0b", "AB"],
  ])("cleans '%s'", (raw, expected) => {
    expect(clean(raw)).toBe(expected);
  });
});

describe("Base", () => {
  it("compares equal values", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.equals("GENODEM1GLS")).toBeTruthy();
    expect(bic.equals(new BIC("GENODEM1GLS"))).toBeTruthy();
    expect(bic.equals(new BIC("MARKDEF1100"))).toBeFalsy();
    expect(bic.equals("MARKDEF1100")).toBeFalsy();
  });

  it("orders values", () => {
    expect(new BIC("AAAADE00").lessThan(new BIC("GENODEM1GLS"))).toBeTruthy();
    expect(new BIC("GENODEM1GLS").lessThan(new BIC("AAAADE00"))).toBeFalsy();
  });

  it("exposes the compact form and length", () => {
    const bic = new BIC("GENODEM1GLS");
    expect(bic.compact).toBe("GENODEM1GLS");
    expect(bic).toHaveLength(11);
  });
});
