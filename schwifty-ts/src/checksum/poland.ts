import { Component } from "../domain.ts";
import { Algorithm, register, weighted } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BANK_CODE, Component.BRANCH_CODE];

  compute(components: string[]): string {
    const weights = [3, 9, 7, 1, 3, 9, 7];
    let digit = weighted(components.join(""), 10, weights);
    digit = digit === 0 ? 0 : 10 - digit;
    return digit.toString();
  }
}

register("PL")(new DefaultAlgorithm());
