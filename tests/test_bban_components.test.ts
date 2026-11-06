import { describe, expect, it } from "vitest";
import { BBAN, computeNationalChecksum } from "../src/bban.ts";
import { Component, componentRecord } from "../src/domain.ts";
import { InvalidAccountCode, InvalidBankCode, InvalidBranchCode, InvalidCountryCode } from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";

function components(values: Partial<Record<Component, string>>): Record<Component, string> {
  return componentRecord((component) => values[component] ?? "");
}

describe("BBAN assembly from components", () => {
  it("pads components with zeros", () => {
    const bban = BBAN.fromComponents("DE", { bank_code: "37040044", account_code: "532013000" });
    expect(bban.compact).toBe("370400440532013000");
    expect(bban.accountCode).toBe("0532013000");
  });

  // If the bank code is given together with the branch code (sort code), the overlapping
  // part is split into the branch code.
  it("splits a combined bank and branch code", () => {
    const bban = BBAN.fromComponents("GB", { bank_code: "NWBK601613", account_code: "31926819" });
    expect(bban.compact).toBe("NWBK60161331926819");
    expect(bban.bankCode).toBe("NWBK");
    expect(bban.branchCode).toBe("601613");
  });

  it("computes the national checksum", () => {
    const italian = BBAN.fromComponents("IT", {
      bank_code: "05428",
      branch_code: "11101",
      account_code: "000000123456",
    });
    expect(italian.compact).toBe("X0542811101000000123456");
    expect(italian.nationalChecksumDigits).toBe("X");

    const belgian = BBAN.fromComponents("BE", { bank_code: "539", account_code: "0075470" });
    expect(belgian.compact).toBe("539007547034");
    expect(belgian.nationalChecksumDigits).toBe("34");
  });

  it("rejects a bank code that is too long", () => {
    expect(() => BBAN.fromComponents("DE", { bank_code: "123456789", account_code: "1" })).toThrow(InvalidBankCode);
  });

  it("rejects a branch code that is too long", () => {
    expect(() => BBAN.fromComponents("IT", { bank_code: "12345", branch_code: "123456", account_code: "1" })).toThrow(
      InvalidBranchCode,
    );
  });

  it("rejects an account code that is too long", () => {
    expect(() => BBAN.fromComponents("DE", { bank_code: "12345678", account_code: "12345678901" })).toThrow(
      InvalidAccountCode,
    );
  });

  it("rejects an unknown country", () => {
    expect(() => BBAN.fromComponents("XX", { bank_code: "1", account_code: "1" })).toThrow(InvalidCountryCode);
  });

  it("rejects a too long bank code in IBAN.generate", () => {
    expect(() => IBAN.generate("DE", "012345678", "7000123456")).toThrow(InvalidBankCode);
  });

  // Countries without a registered default algorithm (and Germany, which only registers
  // named per-bank methods) yield an empty checksum.
  it("computes no national checksum without an algorithm", () => {
    const values = components({
      [Component.BANK_CODE]: "NWBK",
      [Component.BRANCH_CODE]: "601613",
      [Component.ACCOUNT_CODE]: "31926819",
    });
    expect(computeNationalChecksum("GB", values)).toBe("");
    expect(computeNationalChecksum("DE", values)).toBe("");
  });

  it("computes the Belgian national checksum", () => {
    const values = components({ [Component.BANK_CODE]: "539", [Component.ACCOUNT_CODE]: "0075470" });
    expect(computeNationalChecksum("BE", values)).toBe("34");
  });

  it("exposes exotic components", () => {
    const { bban } = new IBAN("BR9700360305000010009795493P1");
    expect(bban.accountId).toBe("1");
    expect(bban.accountType).toBe("P");
    expect(new IBAN("SC18SSCB11010000000000001497USD").bban.currencyCode).toBe("USD");
    expect(new IBAN("IS140159260076545510730339").bban.accountHolderId).toBe("5510730339");
  });
});
