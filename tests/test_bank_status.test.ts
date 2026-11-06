import { afterEach, describe, expect, it, vi } from "vitest";
import { BBAN } from "../src/bban.ts";
import { BIC } from "../src/bic.ts";
import type { Bank } from "../src/domain.ts";
import { BankStatus, compareLookupRank } from "../src/domain.ts";
import * as registry from "../src/registry.ts";

function bank(bic: string, primary: boolean, status: BankStatus = BankStatus.ACTIVE): Bank {
  return {
    bank_code: "10000000",
    bic,
    checksum_algo: "default",
    country_code: "DE",
    legacy_bic: null,
    legacy_name: null,
    name: `Bank ${bic}`,
    primary,
    short_name: null,
    status,
    successor_bank_code: null,
  };
}

function mockRecords(records: Bank[]): void {
  vi.spyOn(registry, "getBanksByCode").mockReturnValue(records);
}

describe("bank status", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reads the status fields of a bank row", () => {
    const parsed = registry.parseBank([
      "SI",
      "06000",
      "KBMASI2XXXX",
      "OTP BANKA D.D.",
      null,
      0,
      "",
      "merged",
      "04000",
      "NOVA KBM D.D.",
    ]);
    expect(parsed.status).toBe(BankStatus.MERGED);
    expect(parsed.successor_bank_code).toBe("04000");
    expect(parsed.legacy_name).toBe("NOVA KBM D.D.");
  });

  it("defaults a bank row to active", () => {
    const parsed = registry.parseBank(["DE", "10000000", "TESTDEFF", "Test", null, 0]);
    expect(parsed.status).toBe(BankStatus.ACTIVE);
    expect(parsed.successor_bank_code).toBeNull();
    expect(parsed.legacy_name).toBeNull();
  });

  it("orders by status before primary", () => {
    const ranked = [
      bank("HEADDEFF", true), // active and primary
      bank("BRCHDEFF", false), // active branch, preferred over any retired record
      bank("MRGDDEFF", false, BankStatus.MERGED), // merged, since the code still leads to a successor
      bank("DLSTDEFF", true, BankStatus.DELISTED), // closed and delisted rank equally, so primary decides
      bank("CLSDDEFF", false, BankStatus.CLOSED),
    ];
    for (const [index, entry] of ranked.slice(1).entries()) {
      expect(compareLookupRank(ranked[index], entry)).toBeGreaterThan(0);
    }
  });

  it("prefers an active branch over a retired head office", () => {
    mockRecords([bank("HEADDEFF", true, BankStatus.DELISTED), bank("BRCHDEFF", false)]);
    expect(BBAN.fromComponents("DE", { bank_code: "10000000" }).bank?.bic).toBe("BRCHDEFF");
  });

  it("prefers the primary among active records", () => {
    mockRecords([bank("BRCHDEFF", false), bank("HEADDEFF", true)]);
    expect(BBAN.fromComponents("DE", { bank_code: "10000000" }).bank?.bic).toBe("HEADDEFF");
  });

  it("prefers merged over delisted", () => {
    mockRecords([bank("DLSTDEFF", true, BankStatus.DELISTED), bank("MRGDDEFF", false, BankStatus.MERGED)]);
    expect(BBAN.fromComponents("DE", { bank_code: "10000000" }).bank?.status).toBe(BankStatus.MERGED);
  });

  it("orders BIC candidates by rank", () => {
    mockRecords([
      bank("DLSTDEFF", true, BankStatus.DELISTED),
      bank("MRGDDEFF", true, BankStatus.MERGED),
      bank("BRCHDEFF", false),
    ]);
    const candidates = BIC.candidatesFromBankCode("DE", "10000000");
    expect(candidates.map((candidate) => candidate.compact)).toStrictEqual(["BRCHDEFF", "MRGDDEFF", "DLSTDEFF"]);
  });

  // Both codes are equally generic, so only the rank of their records decides. The retired
  // head office would win the alphabetical tie-break.
  it("prefers active over a retired primary in BIC.fromBankCode", () => {
    mockRecords([bank("ZZZZDEFF", true, BankStatus.DELISTED), bank("AAAADEFF", false)]);
    expect(BIC.fromBankCode("DE", "10000000").compact).toBe("AAAADEFF");
  });
});
