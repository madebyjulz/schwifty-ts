import { describe, expect, it } from "vitest";
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
