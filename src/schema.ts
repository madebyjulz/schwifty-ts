import { BIC } from "./bic.ts";
import { IBAN } from "./iban.ts";

/**
 * The parts of the Standard Schema specification (https://standardschema.dev)
 * this module implements. Declared locally so the package stays dependency
 * free; the shapes are structurally identical to `@standard-schema/spec`.
 *
 * Upstream ships pydantic hooks so that an `IBAN`/`BIC` can be used as a
 * field type. Standard Schema is the JavaScript equivalent: any library that
 * accepts it (Zod, Valibot, ArkType, tRPC, TanStack Form, ...) can validate a
 * string into an `IBAN`/`BIC` instance with `ibanSchema()`/`bicSchema()`.
 */
export interface StandardSchemaV1<Input = unknown, Output = Input> {
  readonly "~standard": StandardSchemaProps<Input, Output>;
}

export interface StandardSchemaProps<Input = unknown, Output = Input> {
  readonly version: 1;
  readonly vendor: string;
  readonly validate: (value: unknown) => StandardSchemaResult<Output> | Promise<StandardSchemaResult<Output>>;
  readonly types?: StandardSchemaTypes<Input, Output> | undefined;
}

export type StandardSchemaResult<Output> = StandardSchemaSuccess<Output> | StandardSchemaFailure;

export interface StandardSchemaSuccess<Output> {
  readonly value: Output;
  readonly issues?: undefined;
}

export interface StandardSchemaFailure {
  readonly issues: readonly StandardSchemaIssue[];
}

export interface StandardSchemaIssue {
  readonly message: string;
  readonly path?: readonly (PropertyKey | StandardSchemaPathSegment)[] | undefined;
}

export interface StandardSchemaPathSegment {
  readonly key: PropertyKey;
}

export interface StandardSchemaTypes<Input = unknown, Output = Input> {
  readonly input: Input;
  readonly output: Output;
}

const VENDOR = "schwifty-ts";

function schema<Output>(parse: (value: string) => Output): StandardSchemaV1<string, Output> {
  return {
    "~standard": {
      version: 1,
      vendor: VENDOR,
      validate(value: unknown): StandardSchemaResult<Output> {
        if (typeof value !== "string") {
          return { issues: [{ message: `Expected a string, received ${typeof value}` }] };
        }
        try {
          return { value: parse(value) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          return { issues: [{ message }] };
        }
      },
    },
  };
}

/**
 * A Standard Schema that validates a string into an `IBAN`.
 *
 * @param options.validateBban Also validate the country specific BBAN checksum.
 */
export function ibanSchema(options?: { validateBban?: boolean }): StandardSchemaV1<string, IBAN> {
  return schema((value) => new IBAN(value, { validateBban: options?.validateBban }));
}

/**
 * A Standard Schema that validates a string into a `BIC`.
 *
 * @param options.enforceSwiftCompliance Additionally require the bank code to be alphabetic.
 */
export function bicSchema(options?: { enforceSwiftCompliance?: boolean }): StandardSchemaV1<string, BIC> {
  return schema((value) => new BIC(value, { enforceSwiftCompliance: options?.enforceSwiftCompliance }));
}
