import { describe, it, expect } from "vitest";
import { BBAN } from "../src/bban.ts";

describe("BBAN random", () => {
  const countryCodes = ["DE", "ES", "GB", "FR", "PL"];

  it.each(countryCodes)("generates valid BBANs for %s", (countryCode) => {
    const n = 100;
    const bbans: BBAN[] = [];
    for (let i = 0; i < n; i++) {
      const bban = BBAN.random(countryCode);
      bbans.push(bban);
    }
    // Check that we get some variety
    const unique = new Set(bbans.map((b) => b.compact));
    expect(unique.size).toBeGreaterThan(10);

    for (const bban of bbans) {
      expect(bban.bank).not.toBeNull();
      expect(bban.countryCode).toBe(countryCode);
    }
  });

  it.each(countryCodes)(
    "random without registry for %s produces some with no bank",
    (countryCode) => {
      const n = 100;
      let hasNullBank = false;
      for (let i = 0; i < n; i++) {
        const bban = BBAN.random(countryCode, { useRegistry: false });
        if (bban.bank === null) {
          hasNullBank = true;
          break;
        }
      }
      expect(hasNullBank).toBe(true);
    },
  );
});
