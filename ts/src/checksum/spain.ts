import { Component } from "../domain.ts";
import { Algorithm, register, weighted } from "./algorithm.ts";

function reconcile(n: number): number {
  if (n === 11) {
    return 0;
  }
  if (n === 10) {
    return 1;
  }
  return n;
}

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [
    Component.BANK_CODE,
    Component.BRANCH_CODE,
    Component.ACCOUNT_CODE,
  ];

  compute(components: string[]): string {
    const [bankCode, branchCode, accountCode] = components;
    const weights = [1, 2, 4, 8, 5, 10, 9, 7, 3, 6];
    const d1 = reconcile(
      11 - weighted(bankCode + branchCode, 11, weights.slice(2))
    );
    const d2 = reconcile(11 - weighted(accountCode, 11, weights));
    return `${d1}${d2}`;
  }
}

register("ES")(new DefaultAlgorithm());
