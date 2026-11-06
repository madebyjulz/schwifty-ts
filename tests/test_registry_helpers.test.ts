import { describe, expect, it } from "vitest";
import { Component, hasPositions, Range } from "../src/domain.ts";
import { InvalidCountryCode } from "../src/exceptions.ts";
import * as registry from "../src/registry.ts";

function bbanRegex(spec: string): RegExp {
  return new RegExp(registry.convertBbanSpecToRegex(spec), "u");
}

describe("registry helpers", () => {
  it.each([
    ["8!n", String.raw`^\d{8}$`],
    ["4!a2!n", String.raw`^[A-Z]{4}\d{2}$`],
    ["3!c", "^[A-Za-z0-9]{3}$"],
    ["2!e", "^ {2}$"],
    ["5n", String.raw`^\d{1,5}$`],
    ["4!a10!c2!n", String.raw`^[A-Z]{4}[A-Za-z0-9]{10}\d{2}$`],
    ["1!n1!a", String.raw`^\d{1}[A-Z]{1}$`],
  ])("converts the BBAN spec %s", (spec, pattern) => {
    expect(registry.convertBbanSpecToRegex(spec)).toBe(pattern);
  });

  it("matches an exact length", () => {
    const regex = bbanRegex("8!n");
    expect(regex.test("12345678")).toBeTruthy();
    expect(regex.test("1234567")).toBeFalsy();
    expect(regex.test("123456789")).toBeFalsy();
  });

  // Without the `!` marker the count is an upper bound, not exact.
  it("matches a variable length", () => {
    const regex = bbanRegex("5n");
    for (let length = 1; length <= 5; length++) {
      expect(regex.test("1".repeat(length))).toBeTruthy();
    }
    expect(regex.test("1".repeat(6))).toBeFalsy();
  });

  it("matches character classes", () => {
    expect(bbanRegex("3!c").test("A1b")).toBeTruthy();
    expect(bbanRegex("3!c").test("A!b")).toBeFalsy();
    // The `e` class matches spaces only.
    expect(bbanRegex("2!e").test("  ")).toBeTruthy();
    expect(bbanRegex("2!e").test("AB")).toBeFalsy();
  });

  it("rejects an unknown country", () => {
    expect(() => registry.getIbanSpec("XX")).toThrow(InvalidCountryCode);
    expect(() => registry.getIbanSpec("XX")).toThrow("Unknown country-code 'XX'");
  });

  it("caches the IBAN spec", () => {
    expect(registry.getIbanSpec("DE")).toBe(registry.getIbanSpec("DE"));
  });

  it("parses the IBAN spec fields", () => {
    const spec = registry.getIbanSpec("DE");
    expect(spec.country).toBe("DE");
    expect(spec.bban_spec).toBe("8!n10!n");
    expect(spec.bban_length).toBe(18);
    expect(spec.iban_length).toBe(22);
    expect(spec.in_sepa_zone).toBeTruthy();
    expect(spec.positions[Component.BANK_CODE]).toStrictEqual(new Range(0, 8));
    expect(spec.positions[Component.ACCOUNT_CODE]).toStrictEqual(new Range(8, 18));
  });

  it("returns nothing for unknown keys", () => {
    expect(registry.getBanksByCode("DE", "00000000")).toStrictEqual([]);
    expect(registry.getBanksByBic("DEUTDEDB999")).toStrictEqual([]);
    expect(registry.getBanksByCountry("XX")).toStrictEqual([]);
  });

  it("describes a range", () => {
    const range = new Range(2, 5);
    expect(range).toHaveLength(3);
    expect(range.isEmpty).toBeFalsy();
    expect(range.cut("abcdefgh")).toBe("cde");
  });

  it("describes an empty range", () => {
    expect(new Range()).toStrictEqual(new Range(0, 0));
    expect(new Range().isEmpty).toBeTruthy();
    expect(new Range()).toHaveLength(0);
    // A range starting at 0 is not empty when it has a positive length.
    expect(new Range(0, 3).isEmpty).toBeFalsy();
    expect(new Range(0, 3).cut("abcdef")).toBe("abc");
  });

  it("tells whether a spec has positions", () => {
    expect(hasPositions(registry.getIbanSpec("DE"))).toBeTruthy();
    // Angola defines a BBAN regex but no component positions.
    expect(hasPositions(registry.getIbanSpec("AO"))).toBeFalsy();
  });
});
