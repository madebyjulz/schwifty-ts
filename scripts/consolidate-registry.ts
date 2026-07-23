/**
 * Consolidates the registry JSON files shipped with the Python `schwifty`
 * package (the `schwifty-py` submodule) into single importable JSON files.
 *
 * Run before build: node scripts/consolidate-registry.ts
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

// Declared as an interface rather than `Record<string, JsonValue>` so the
// mutual recursion with `JsonValue` is deferred instead of circular.
interface JsonObject {
  [key: string]: JsonValue;
}
type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject;

/**
 * A `*_v2.json` chunk: a list of entries plus instructions for fanning one
 * array-valued field out into one entry per element.
 */
interface V2Chunk {
  entries: JsonObject[];
  expand_from: string;
  expand_into: string;
  grouping_keys?: string[];
}

const projectRoot = path.join(import.meta.dirname, "..");
const registrySource = path.join(projectRoot, "schwifty-py", "schwifty");
const outDir = path.join(projectRoot, "src", "data");
const BYTES_PER_KIB = 1024;

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonObjectArray(value: unknown): value is JsonObject[] {
  return Array.isArray(value) && value.every((item) => isJsonObject(item));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isV2Chunk(value: unknown): value is V2Chunk {
  return (
    isJsonObject(value) &&
    isJsonObjectArray(value.entries) &&
    typeof value.expand_from === "string" &&
    typeof value.expand_into === "string" &&
    (value.grouping_keys === undefined || isStringArray(value.grouping_keys))
  );
}

function mergeDicts(left: JsonObject, right: JsonObject): JsonObject {
  const merged: JsonObject = {};
  for (const key of Object.keys(right)) {
    if (key in left) {
      const lv = left[key];
      const rv = right[key];
      merged[key] = isJsonObject(lv) && isJsonObject(rv) ? mergeDicts(lv, rv) : rv;
    }
  }
  for (const key of Object.keys(left)) {
    if (!(key in merged)) {
      merged[key] = left[key];
    }
  }
  for (const key of Object.keys(right)) {
    if (!(key in merged)) {
      merged[key] = right[key];
    }
  }
  return merged;
}

function parseV2(chunk: V2Chunk): JsonObject[] {
  const { entries, expand_from: expandFrom, expand_into: expandInto, grouping_keys: groupingKeys } = chunk;
  const dropped = new Set<string>([expandFrom, ...(groupingKeys ?? [])]);
  const result: JsonObject[] = [];

  for (const entry of entries) {
    const values = entry[expandFrom];
    if (!Array.isArray(values)) {
      throw new TypeError(`Expected '${expandFrom}' to be an array in ${JSON.stringify(entry)}`);
    }

    const base: JsonObject = Object.fromEntries(Object.entries(entry).filter(([key]) => !dropped.has(key)));
    if (!("primary" in base) && !dropped.has("primary")) {
      base.primary = false;
    }

    for (const value of values) {
      result.push({ ...base, [expandInto]: value });
    }
  }
  return result;
}

function loadRegistry(name: string): JsonObject[] | JsonObject {
  const directory = path.join(registrySource, `${name}_registry`);
  const files = readdirSync(directory)
    .filter((file) => file.endsWith(".json"))
    .toSorted();

  let data: JsonObject[] | JsonObject | null = null;

  for (const file of files) {
    const parsed: unknown = JSON.parse(readFileSync(path.join(directory, file), "utf-8"));

    let chunk: JsonObject[] | JsonObject;
    if (path.basename(file, ".json").endsWith("v2")) {
      if (!isV2Chunk(parsed)) {
        throw new TypeError(`${file} is not a valid v2 registry chunk`);
      }
      chunk = parseV2(parsed);
    } else if (isJsonObjectArray(parsed) || isJsonObject(parsed)) {
      chunk = parsed;
    } else {
      throw new TypeError(`${file} is neither a JSON object nor a list of objects`);
    }

    if (data === null) {
      data = chunk;
    } else if (Array.isArray(data)) {
      if (!Array.isArray(chunk)) {
        throw new TypeError(`${file} is an object but the registry so far is a list`);
      }
      data.push(...chunk);
    } else {
      if (Array.isArray(chunk)) {
        throw new TypeError(`${file} is a list but the registry so far is an object`);
      }
      data = mergeDicts(data, chunk);
    }
  }

  if (data === null) {
    throw new Error(`No registry files found in ${directory}`);
  }
  return data;
}

const REGISTRIES = ["bank", "iban"];

/**
 * The `schwifty-py` submodule is only checked out in a full development clone.
 * Fresh worktrees (e.g. the one `git-publish` packs from) get an empty
 * directory, but the consolidated JSON is committed, so regeneration can be
 * skipped there.
 */
function sourceIsAvailable(): boolean {
  return REGISTRIES.every((name) => existsSync(path.join(registrySource, `${name}_registry`)));
}

function outputIsPresent(): boolean {
  return REGISTRIES.every((name) => existsSync(path.join(outDir, `${name}.json`)));
}

if (sourceIsAvailable()) {
  mkdirSync(outDir, { recursive: true });

  for (const name of REGISTRIES) {
    const outPath = path.join(outDir, `${name}.json`);
    writeFileSync(outPath, JSON.stringify(loadRegistry(name)));
    const size = (readFileSync(outPath).length / BYTES_PER_KIB).toFixed(1);
    console.log(`${name}: ${outPath} (${size} KB)`);
  }
} else if (outputIsPresent()) {
  console.log(`schwifty-py submodule not checked out; reusing existing ${outDir}`);
} else {
  throw new Error(
    `No registry source at ${registrySource} and no consolidated JSON in ${outDir}. ` +
      "Run `git submodule update --init` first.",
  );
}
