import { Component } from "../domain.ts";
import { Algorithm, DIGITS, register, weighted } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BRANCH_CODE, Component.ACCOUNT_CODE];
  readonly weights = [6, 3, 7, 9, 10, 5, 8, 4, 2, 1];

  compute(_components: string[]): string {
    return "";
  }

  override validate(components: string[], _expected: string): boolean {
    const [branchCode, accountCode] = components;
    const d1 = weighted(branchCode, 11, this.weights.slice(4));
    const d2 = weighted(accountCode, 11, this.weights);
    return d1 === 0 && d2 === 0;
  }

  override solve(components: string[]): string[] | null {
    // There is no dedicated check digit: the whole branch and account codes must
    // each weigh to 0 mod 11. Their trailing position has weight 1, so cycling it
    // reaches every residue but one — the value 10, which no single digit can
    // supply and which then triggers a regeneration.
    const [branchCode, accountCode] = components;
    const branch = this._solveCode(branchCode, this.weights.slice(4));
    const account = this._solveCode(accountCode, this.weights);
    if (branch === null || account === null) {
      return null;
    }
    return [branch, account];
  }

  private _solveCode(code: string, weights: number[]): string | null {
    for (const digit of DIGITS) {
      const candidate = code.slice(0, -1) + digit;
      if (weighted(candidate, 11, weights) === 0) {
        return candidate;
      }
    }
    return null;
  }
}

register("CZ", "SK")(new DefaultAlgorithm());
