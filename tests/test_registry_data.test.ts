import { describe, expect, it } from "vitest";
import { mod97, numerify } from "../src/checksum/algorithm.ts";
import bankRows from "../src/data/bank.ts";
import { getAllBanks, getBanksByBic, getBanksByCode } from "../src/registry.ts";

describe("bank registry encoding", () => {
  it("decodes every row into a fully populated Bank", () => {
    const banks = getAllBanks();
    expect(banks).toHaveLength(bankRows.length);
    for (const bank of banks) {
      expect(bank.country_code).toBeTypeOf("string");
      expect(bank.bank_code).toBeTypeOf("string");
      expect(bank.bic).toBeTypeOf("string");
      expect(bank.name).toBeTypeOf("string");
      expect(bank.short_name === null || typeof bank.short_name === "string").toBeTruthy();
      expect(bank.primary).toBeTypeOf("boolean");
      expect(bank.checksum_algo).not.toBe("");
    }
  });

  it("keeps the trailing checksum_algo default when the row omits it", () => {
    const [commerzbank] = getBanksByCode("DE", "37040044");
    expect(commerzbank.checksum_algo).toBe("13");
    const [nationalbank] = getBanksByBic("NABAATWWXXX");
    expect(nationalbank.checksum_algo).toBe("default");
  });
});

describe(mod97, () => {
  it.each(["370400440532013000DE8900", "0", "ZZZZZZZZZZZZZZZZZZZZZZZZZZ", "1A2B3C4D5E6F7G8H9I0J", "3M02606FR14"])(
    "matches numerify(%s) modulo 97",
    (value) => {
      expect(BigInt(mod97(value))).toBe(numerify(value) % 97n);
    },
  );
});
