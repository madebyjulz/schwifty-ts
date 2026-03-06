import { Component } from "../domain.ts";
import { Algorithm, register, weighted } from "./algorithm.ts";

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
    return this.compute(components) === accountHolderId[8];
  }
}

register("IS")(new DefaultAlgorithm());
