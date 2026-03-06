import { Component } from "../domain.ts";
import { Algorithm, register } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BRANCH_CODE, Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    const joined = components.join("");
    const reversed = joined.split("").reverse();
    const weights = [7, 3, 1];
    let sum = 0;
    for (let i = 0; i < reversed.length; i++) {
      sum += weights[i % weights.length] * Number.parseInt(reversed[i], 10);
    }
    let digit = sum % 10;
    digit = digit === 0 ? 0 : 10 - digit;
    return digit.toString();
  }
}

register("EE")(new DefaultAlgorithm());
