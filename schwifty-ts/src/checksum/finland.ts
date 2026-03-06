import { Component } from "../domain.ts";
import { Algorithm, luhn, register } from "./algorithm.ts";

class DefaultAlgorithm extends Algorithm {
  override readonly name = "default";
  override readonly accepts = [Component.BANK_CODE, Component.ACCOUNT_CODE];

  compute(components: string[]): string {
    return luhn(components.join(""));
  }
}

register("FI")(new DefaultAlgorithm());
