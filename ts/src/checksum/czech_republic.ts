import { Component } from "../domain.ts";
import { Algorithm, register, weighted } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BRANCH_CODE, Component.ACCOUNT_CODE];

  compute(_components: string[]): string {
    return "";
  }

  override validate(components: string[], _expected: string): boolean {
    const [branchCode, accountCode] = components;
    const weights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];
    const d1 = weighted(branchCode, 11, weights.slice(4));
    const d2 = weighted(accountCode, 11, weights);
    return d1 === 0 && d2 === 0;
  }
}

register("CZ", "SK")(new DefaultAlgorithm());
