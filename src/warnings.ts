/**
 * The subset of Python's `warnings` module that upstream relies on.
 *
 * JavaScript has no warning machinery of its own, so upstream's
 * `warnings.warn(..., NationalChecksumNotVerified)` and the documented
 * `warnings.simplefilter("error", NationalChecksumNotVerified)` opt-in are
 * mirrored here with the same names and semantics:
 *
 * - `"default"` reports each distinct warning once, like Python's default
 *   filter, so validating many IBANs of one country does not flood the log.
 * - `"always"` reports every occurrence.
 * - `"error"` throws the warning instead.
 * - `"ignore"` drops it.
 *
 * Warnings are reported through `process.emitWarning` where the runtime has
 * one (Node.js, Bun, Deno) and through `console.warn` otherwise (browsers).
 */

export type WarningAction = "default" | "always" | "error" | "ignore";

export type WarningCategory = abstract new (...args: never[]) => Error;

interface Filter {
  action: WarningAction;
  category: WarningCategory;
}

const _filters: Filter[] = [];
const _reported = new Set<string>();

/**
 * Apply `action` to every warning that is an instance of `category`.
 *
 * Later filters take precedence over earlier ones, as in Python.
 */
export function simplefilter(action: WarningAction, category: WarningCategory = Error): void {
  _filters.unshift({ action, category });
  // Python invalidates its "already reported" registry whenever the filters change.
  _reported.clear();
}

/** Remove every filter installed with `simplefilter`. */
export function resetwarnings(): void {
  _filters.length = 0;
  _reported.clear();
}

function _report(warning: Error): void {
  if (typeof process !== "undefined" && typeof process.emitWarning === "function") {
    process.emitWarning(warning);
    return;
  }
  // oxlint-disable-next-line no-console -- browsers have no other channel for a non-fatal warning
  console.warn(`${warning.name}: ${warning.message}`);
}

export function warn(warning: Error): void {
  const action = _filters.find((filter) => warning instanceof filter.category)?.action ?? "default";
  if (action === "ignore") {
    return;
  }
  if (action === "error") {
    throw warning;
  }
  if (action === "default") {
    const key = `${warning.name}: ${warning.message}`;
    if (_reported.has(key)) {
      return;
    }
    _reported.add(key);
  }
  _report(warning);
}
