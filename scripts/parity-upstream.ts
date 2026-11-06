/**
 * Check that the built package behaves like the Python package in `schwifty-py`.
 *
 *   pnpm parity
 *
 * scripts/parity_upstream.py evaluates a generated corpus of IBANs, BICs and
 * bank codes with Python. This script replays every case against `dist` and
 * compares attribute by attribute, including the exception class on failure.
 * `dist` rather than `src` because Node cannot load the JSON imports in `src`.
 *
 * The submodule has to be at the ported revision, otherwise differences are
 * expected. Mismatches are grouped by case kind and attribute; the full list
 * is written to `.cache/parity-mismatches.json`.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type * as SchwiftyModule from "../src/index.ts";

type Schwifty = typeof SchwiftyModule;

interface ParityCase {
  expected: unknown;
  input: string | string[];
  kind: string;
}

interface Mismatch {
  actual: unknown;
  attribute: string;
  expected: unknown;
  input: string | string[];
  kind: string;
}

/**
 * Differences that are documented deviations from upstream. Every entry needs
 * a matching note in the changelog; `attribute` is the Python name.
 */
const KNOWN_DEVIATIONS: { attribute: string; kind: string; reason: string }[] = [];

const MAX_PRINTED_SAMPLES = 3;
const PYTHON_BUFFER_BYTES = 64 * 1024 * 1024;

const projectRoot = path.join(import.meta.dirname, "..");
const reportPath = path.join(projectRoot, ".cache", "parity-mismatches.json");

function runPython(output: string): void {
  execFileSync(
    "uv",
    ["run", "--frozen", "--quiet", "--project", "schwifty-py", "python", "scripts/parity_upstream.py", output],
    { cwd: projectRoot, maxBuffer: PYTHON_BUFFER_BYTES, stdio: "inherit" },
  );
}

function loadCases(): ParityCase[] {
  const directory = mkdtempSync(path.join(tmpdir(), "schwifty-parity-"));
  try {
    const output = path.join(directory, "cases.json");
    runPython(output);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by parity_upstream.py
    return JSON.parse(readFileSync(output, "utf-8")) as ParityCase[];
  } finally {
    rmSync(directory, { force: true, recursive: true });
  }
}

function toCamelCase(name: string): string {
  return name.replaceAll(/_(?<letter>[a-z])/gu, (_, letter: string) => letter.toUpperCase());
}

/** The counterpart of `normalize` in parity_upstream.py. */
function normalize(value: unknown): unknown {
  if (value === undefined) {
    return "<missing in port>";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalize(item));
  }
  if (typeof value === "object" && value !== null && "compact" in value) {
    return value.compact;
  }
  return value;
}

function toError(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.name : String(error) };
}

function readAttributes(target: object, names: string[], rename: (name: string) => string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const name of names) {
    try {
      result[name] = normalize(Reflect.get(target, rename(name)));
    } catch (error) {
      result[name] = toError(error);
    }
  }
  return result;
}

function attributeNames(expected: unknown): string[] {
  return typeof expected === "object" && expected !== null ? Object.keys(expected) : [];
}

function isErrorResult(expected: unknown): boolean {
  return typeof expected === "object" && expected !== null && "error" in expected;
}

function evaluate(build: () => object, expected: unknown): unknown {
  let target: object;
  try {
    target = build();
  } catch (error) {
    return toError(error);
  }
  // A case Python rejects still needs an attribute to compare, so report the value itself.
  return isErrorResult(expected)
    ? { value: normalize(target) }
    : readAttributes(target, attributeNames(expected), toCamelCase);
}

function replay(schwifty: Schwifty, { expected, input, kind }: ParityCase): unknown {
  const arguments_ = [input].flat();
  const [first = "", second = "", third = "", fourth = ""] = arguments_;

  if (kind === "banks_by_code") {
    const records = Array.isArray(expected) ? expected : [];
    return schwifty
      .getBanksByCode(first, second)
      .map((bank) => readAttributes(bank, attributeNames(records[0]), (name) => name));
  }
  if (kind === "from_bank_code") {
    return evaluate(() => schwifty.BIC.fromBankCode(first, second), expected);
  }
  if (kind === "bic") {
    return evaluate(() => new schwifty.BIC(first), expected);
  }
  if (kind === "generate") {
    return evaluate(() => schwifty.IBAN.generate(first, second, third, fourth), expected);
  }
  if (kind === "iban") {
    return evaluate(() => new schwifty.IBAN(first, { validateBban: true }), expected);
  }
  throw new Error(`Unknown case kind '${kind}'`);
}

function isKnownDeviation(mismatch: Mismatch): boolean {
  return KNOWN_DEVIATIONS.some(({ attribute, kind }) => kind === mismatch.kind && attribute === mismatch.attribute);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !("error" in value);
}

function compareRecords(parityCase: ParityCase, expected: unknown, actual: unknown): Mismatch[] {
  const { input, kind } = parityCase;
  if (!isRecord(expected) || !isRecord(actual)) {
    return isDeepStrictEqual(actual, expected) ? [] : [{ actual, attribute: "<result>", expected, input, kind }];
  }
  const mismatches: Mismatch[] = [];
  for (const [attribute, value] of Object.entries(expected)) {
    if (!isDeepStrictEqual(actual[attribute], value)) {
      mismatches.push({ actual: actual[attribute], attribute, expected: value, input, kind });
    }
  }
  return mismatches;
}

function compare(parityCase: ParityCase, actual: unknown): Mismatch[] {
  const { expected, input, kind } = parityCase;
  if (!Array.isArray(expected) || !Array.isArray(actual)) {
    return compareRecords(parityCase, expected, actual);
  }
  if (expected.length !== actual.length) {
    return [{ actual, attribute: "<result>", expected, input, kind }];
  }
  return expected.flatMap((record, index) => compareRecords(parityCase, record, actual[index]));
}

function report(total: number, mismatches: Mismatch[]): void {
  console.log(`${total} cases, ${mismatches.length} mismatches`);
  if (mismatches.length === 0) {
    return;
  }

  const groups = new Map<string, Mismatch[]>();
  for (const mismatch of mismatches) {
    const key = `${mismatch.kind}.${mismatch.attribute}`;
    groups.set(key, [...(groups.get(key) ?? []), mismatch]);
  }
  const sorted = [...groups].toSorted(([, left], [, right]) => right.length - left.length);
  for (const [group, entries] of sorted) {
    console.log(`\n${group}: ${entries.length}`);
    for (const { actual, expected, input } of entries.slice(0, MAX_PRINTED_SAMPLES)) {
      console.log(`  ${JSON.stringify(input)}`);
      console.log(`    python: ${JSON.stringify(expected)}`);
      console.log(`    port:   ${JSON.stringify(actual)}`);
    }
  }

  mkdirSync(path.dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(mismatches, null, 2));
  console.log(`\nAll mismatches: ${path.relative(projectRoot, reportPath)}`);
}

const entry = pathToFileURL(path.join(projectRoot, "dist", "index.mjs")).href;
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- dist is built from src/index.ts
const schwifty = (await import(entry)) as Schwifty;

const cases = loadCases();
const mismatches: Mismatch[] = [];
for (const parityCase of cases) {
  let actual: unknown;
  try {
    actual = replay(schwifty, parityCase);
  } catch (error) {
    actual = toError(error);
  }
  mismatches.push(...compare(parityCase, actual).filter((mismatch) => !isKnownDeviation(mismatch)));
}

report(cases.length, mismatches);
if (mismatches.length > 0) {
  process.exitCode = 1;
}
