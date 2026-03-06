export {
  Algorithm,
  algorithms,
  getAlgorithm,
  ISO7064Mod97_10,
  iso7064,
  luhn,
  numerify,
  register,
  weighted,
} from "./algorithm.ts";

// Import all country modules to trigger registration
import "./iso7064_mod97_10.ts";
import "./iso7064_mod97_10_variant.ts";
import "./belgium.ts";
import "./france.ts";
import "./italy.ts";
import "./spain.ts";
import "./norway.ts";
import "./finland.ts";
import "./estonia.ts";
import "./czech_republic.ts";
import "./iceland.ts";
import "./poland.ts";
import "./germany.ts";
