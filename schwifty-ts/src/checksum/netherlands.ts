import { Component } from "../domain.ts";
import { Algorithm } from "./algorithm.ts";

// Not registered anymore for Dutch IBANs
export class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.ACCOUNT_CODE];

  compute(_components: string[]): string {
    return "";
  }

  override validate(components: string[], _expected: string): boolean {
    const [accountCode] = components;
    let sum = 0;
    for (let i = 0; i < accountCode.length; i++) {
      sum += Number.parseInt(accountCode[i], 10) * (10 - i);
    }
    return sum % 11 === 0;
  }
}
