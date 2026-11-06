import { describe, expect, it } from "vitest";
import { BBAN } from "../src/bban.ts";
import { BIC } from "../src/bic.ts";
import { BankStatus } from "../src/domain.ts";
import { InvalidBBANChecksum } from "../src/exceptions.ts";
import { IBAN } from "../src/iban.ts";
import * as registry from "../src/registry.ts";

// The Bundesbank deleted the bank code of Eurocity Bank without a successor; it uses checksum
// method 16.
const CLOSED_BANK_CODE = "10030700";
const CLOSED_BIC = "DLGHDEB1";

describe("retired banks", () => {
  // The bank of an IBAN is identified even if it no longer exists. Its status tells that no
  // payments can be made to it.
  it("returns a closed bank with its status", () => {
    const iban = IBAN.generate("DE", CLOSED_BANK_CODE, "1234567890");
    expect(iban.bank?.name).toBe("Eurocity Bank");
    expect(iban.bank?.status).toBe(BankStatus.DELISTED);
    expect(iban.bank?.successor_bank_code).toBeNull();
    expect(iban.bankName).toBe("Eurocity Bank");
    expect(iban.bic?.compact).toBe(CLOSED_BIC);
  });

  it("includes closed banks in registry lookups", () => {
    expect(registry.getBanksByCode("DE", CLOSED_BANK_CODE)).not.toHaveLength(0);
    expect(registry.getAllBanks().some((bank) => bank.status === BankStatus.DELISTED)).toBeTruthy();
  });

  it("resolves the BIC of a closed bank", () => {
    expect(BIC.fromBankCode("DE", CLOSED_BANK_CODE).compact).toBe(CLOSED_BIC);
    expect(new BIC(CLOSED_BIC).exists).toBeTruthy();
    expect(new BIC(CLOSED_BIC).bankNames).toContain("Eurocity Bank");
  });

  it("still validates account codes of closed banks", () => {
    const bban = BBAN.random("DE", { values: { bank_code: CLOSED_BANK_CODE } });
    expect(bban.validateNationalChecksum()).toBeTruthy();

    const { accountCode } = bban;
    const invalid = `${accountCode.slice(0, -1)}${(Number(accountCode.at(-1)) + 1) % 10}`;
    expect(() => new BBAN("DE", `${CLOSED_BANK_CODE}${invalid}`).validateNationalChecksum()).toThrow(
      InvalidBBANChecksum,
    );
  });

  it.each([
    ["DE", "13061088", "13061078", "Volks- und Raiffeisenbank"],
    ["CH", "31000", "30005", "UBS Switzerland AG - Zürich"],
    ["SI", "03100", "04000", "OTP BANKA D.D."],
  ])("resolves the merged bank code %s %s to its successor", (countryCode, bankCode, successorBankCode, name) => {
    const bban = BBAN.fromComponents(countryCode, { bank_code: bankCode });
    expect(bban.bank?.status).toBe(BankStatus.MERGED);
    expect(bban.bank?.successor_bank_code).toBe(successorBankCode);
    expect(bban.bank?.name).toBe(name);
    expect(bban.bic?.compact).toBe(BBAN.fromComponents(countryCode, { bank_code: successorBankCode }).bic?.compact);
  });

  // Raiffeisenbank Wismar (13061088) was merged into Volks- und Raiffeisenbank (13061078).
  it("resolves the BIC of a merged bank to its retired bank code", () => {
    const bic = new BIC("GENODEF1HWR");
    expect(bic.exists).toBeTruthy();
    expect(bic.domesticBankCodes).toStrictEqual(["13061088"]);
    expect(bic.bankNames).toStrictEqual(["Volks- und Raiffeisenbank"]);

    const banks = registry.getBanksByBic("GENODEF1HWR");
    expect(banks).toHaveLength(1);
    expect(banks[0].legacy_bic).toBe("GENODEF1HWR");
    expect(banks[0].bic).toBe("GENODEF1HWI");
    expect(banks[0].successor_bank_code).toBe("13061078");

    expect(IBAN.generate("DE", "13061088", "1234567").bic?.compact).toBe("GENODEF1HWI");
  });

  // Account codes issued under the retired bank code of Volksbank Wismar were computed with
  // its own method (06), not the one of its successor (32).
  it("keeps the checksum method of a merged bank code", () => {
    const [alias] = registry.getBanksByCode("DE", "13091084");
    const successor = registry.getBanksByCode("DE", "13061078").find((bank) => bank.primary);
    expect(alias.successor_bank_code).toBe(successor?.bank_code);
    expect(alias.checksum_algo).toBe("06");
    expect(successor?.checksum_algo).toBe("32");
  });

  // A successor can have merged itself since, but the chain of successors has to end. Some
  // sources name successors they don't list themselves, so only the registries whose update
  // scripts build aliases of the successor are required to know it.
  it("knows the successors of retired bank codes", () => {
    const unknown: unknown[] = [];
    const cycles: unknown[] = [];
    for (const bank of registry.getAllBanks()) {
      let current = bank;
      const seen = new Set([bank.bank_code]);
      while (current.successor_bank_code !== null) {
        const [successor] = registry.getBanksByCode(current.country_code, current.successor_bank_code);
        if (successor === undefined) {
          if (["CH", "DE", "SI"].includes(current.country_code)) {
            unknown.push(current);
          }
          break;
        }
        if (seen.has(current.successor_bank_code)) {
          cycles.push(bank);
          break;
        }
        seen.add(current.successor_bank_code);
        current = successor;
      }
    }
    expect(unknown).toStrictEqual([]);
    expect(cycles).toStrictEqual([]);
  });

  it("never uses retired bank codes in random IBANs", () => {
    for (let attempt = 0; attempt < 300; attempt++) {
      for (const countryCode of ["DE", "LV", "SI"]) {
        const { bank } = IBAN.random(countryCode);
        expect(bank === null || bank.status === BankStatus.ACTIVE).toBeTruthy();
      }
    }
  });
});
