import { ISO7064Mod97_10, register } from "./algorithm.ts";

// Bosnia and Herzegovina (BA), Montenegro (ME), North Macedonia (MK),
// Portugal (PT), Serbia (RS), Slovenia (SI), East Timor (TL), Kosovo (XK)
class DefaultAlgorithm extends ISO7064Mod97_10 {
  override readonly name = "default";
}

register("BA", "ME", "MK", "PT", "RS", "SI", "TL", "XK")(new DefaultAlgorithm());
