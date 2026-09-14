import { Component } from "../domain.ts";
import { InvalidAccountCode } from "../exceptions.ts";
import { Algorithm, register, weighted } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BANK_CODE, Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    const [bankCode, accountCode] = components;
    const value = accountCode.startsWith("00") ? accountCode.slice(2) : bankCode + accountCode;

    const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
    const checkDigit = 11 - weighted(value, 11, weights);
    if (checkDigit === 10) {
      throw new InvalidAccountCode("Check digit does not compute: Invalid account code.");
    }
    return (checkDigit % 11).toString();
  }
}

register("NO")(new DefaultAlgorithm());
