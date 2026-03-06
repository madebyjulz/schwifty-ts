import { Component } from "../domain.ts";
import { InvalidAccountCode } from "../exceptions.ts";
import { Algorithm, register } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BANK_CODE, Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    const [bankCode, accountCode] = components;
    const value =
      accountCode.slice(0, 2) === "00"
        ? accountCode.slice(2)
        : bankCode + accountCode;

    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    let total = 0;
    for (let i = 0; i < Math.min(weights.length, value.length); i++) {
      total += weights[i] * Number.parseInt(value[i], 10);
    }

    const checkDigit = 11 - (total % 11);
    if (checkDigit === 10) {
      throw new InvalidAccountCode(
        "Check digit does not compute: Invalid account code."
      );
    }
    return (checkDigit % 11).toString();
  }
}

register("NO")(new DefaultAlgorithm());
