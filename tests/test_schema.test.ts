import { describe, expect, it } from "vitest";
import { BIC } from "../src/bic.ts";
import { IBAN } from "../src/iban.ts";
import { bicSchema, ibanSchema } from "../src/schema.ts";

describe(ibanSchema, () => {
  it("implements the Standard Schema interface", () => {
    const { "~standard": props } = ibanSchema();
    expect(props.version).toBe(1);
    expect(props.vendor).toBe("@madebyjulz/schwifty-ts");
  });

  it("parses a valid IBAN into an instance", () => {
    const result = ibanSchema()["~standard"].validate(" de89 3704 0044 0532 0130 00 ");
    expect(result).not.toBeInstanceOf(Promise);
    if (result instanceof Promise || result.issues) {
      throw new Error("expected a success result");
    }
    expect(result.value).toBeInstanceOf(IBAN);
    expect(result.value.compact).toBe("DE89370400440532013000");
  });

  it("reports the schwifty error message as an issue", () => {
    const result = ibanSchema()["~standard"].validate("DE88370400440532013000");
    expect(result).toStrictEqual({ issues: [{ message: "Invalid checksum digits" }] });
  });

  it("rejects non-strings", () => {
    const result = ibanSchema()["~standard"].validate(42);
    expect(result).toStrictEqual({ issues: [{ message: "Expected a string, received number" }] });
  });

  it("forwards the validateBban option", () => {
    // Valid ISO 7064 check digits, invalid Belgian national checksum (should end in 34).
    const iban = IBAN.fromBban("BE", "539007547035").compact;
    expect(ibanSchema()["~standard"].validate(iban)).toHaveProperty("value");
    expect(ibanSchema({ validateBban: true })["~standard"].validate(iban)).toHaveProperty("issues");
  });
});

describe(bicSchema, () => {
  it("parses a valid BIC into an instance", () => {
    const result = bicSchema()["~standard"].validate("genodem1gls");
    if (result instanceof Promise || result.issues) {
      throw new Error("expected a success result");
    }
    expect(result.value).toBeInstanceOf(BIC);
    expect(result.value.compact).toBe("GENODEM1GLS");
  });

  it("forwards the enforceSwiftCompliance option", () => {
    expect(bicSchema()["~standard"].validate("1234DEWWXXX")).toHaveProperty("value");
    expect(bicSchema({ enforceSwiftCompliance: true })["~standard"].validate("1234DEWWXXX")).toHaveProperty("issues");
  });
});
