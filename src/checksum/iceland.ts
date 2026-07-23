import { Component } from "../domain.ts";
import { Algorithm, DIGITS, register, weighted } from "./algorithm.ts";

const CHECK_DIGIT_INDEX = 8;

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.ACCOUNT_HOLDER_ID];

  compute(components: string[]): string {
    const [accountHolderId] = components;
    const weights = [3, 2, 7, 6, 5, 4, 3, 2];
    const remainder = weighted(accountHolderId, 11, weights);
    return remainder === 0 ? "0" : (11 - remainder).toString();
  }

  override validate(components: string[], _expected: string): boolean {
    const [accountHolderId] = components;
    return this.compute(components) === accountHolderId[CHECK_DIGIT_INDEX];
  }

  override solve(components: string[]): string[] | null {
    // The check digit sits at a fixed position in the account holder id and does
    // not feed back into its own computation, so trying every value there yields
    // the single valid one — or none when the id requires a check digit of 10.
    const [accountHolderId] = components;
    for (const digit of DIGITS) {
      const candidate =
        accountHolderId.slice(0, CHECK_DIGIT_INDEX) + digit + accountHolderId.slice(CHECK_DIGIT_INDEX + 1);
      if (this.validate([candidate], "")) {
        return [candidate];
      }
    }
    return null;
  }
}

register("IS")(new DefaultAlgorithm());
