#!/usr/bin/env node
/**
 * Consolidates registry JSON files into single importable JSON files.
 * Run before build: node scripts/consolidate-registry.mjs
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const registrySource = join(projectRoot, "schwifty");
const outDir = join(projectRoot, "ts", "src", "data");

function mergeDicts(left, right) {
  const merged = {};
  for (const key of Object.keys(right)) {
    if (key in left) {
      const lv = left[key];
      const rv = right[key];
      if (
        typeof lv === "object" &&
        lv !== null &&
        !Array.isArray(lv) &&
        typeof rv === "object" &&
        rv !== null &&
        !Array.isArray(rv)
      ) {
        merged[key] = mergeDicts(lv, rv);
      } else {
        merged[key] = rv;
      }
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

function parseV2(data) {
  const entries = data.entries;
  const expandFrom = data.expand_from;
  const expandInto = data.expand_into;
  const groupingKeys = data.grouping_keys;

  const result = [];
  for (const entry of entries) {
    const values = entry[expandFrom];
    const base = { ...entry };
    delete base[expandFrom];
    if (!("primary" in base)) {
      base.primary = false;
    }

    if (groupingKeys) {
      for (const gk of groupingKeys) {
        if (gk in base) {
          delete base[gk];
        }
      }
    }

    for (const value of values) {
      result.push({ ...base, [expandInto]: value });
    }
  }
  return result;
}

function loadRegistry(name) {
  const directory = join(registrySource, `${name}_registry`);
  const entries = readdirSync(directory)
    .filter((f) => f.endsWith(".json"))
    .sort();

  let data = null;
  for (const entry of entries) {
    const content = readFileSync(join(directory, entry), "utf-8");
    let chunk = JSON.parse(content);
    if (entry.replace(".json", "").endsWith("v2")) {
      chunk = parseV2(chunk);
    }
    if (data === null) {
      data = chunk;
    } else if (Array.isArray(data)) {
      data.push(...chunk);
    } else {
      data = mergeDicts(data, chunk);
    }
  }
  return data;
}

mkdirSync(outDir, { recursive: true });

for (const name of ["bank", "iban"]) {
  const data = loadRegistry(name);
  const outPath = join(outDir, `${name}.json`);
  writeFileSync(outPath, JSON.stringify(data));
  const size = (readFileSync(outPath).length / 1024).toFixed(1);
  console.log(`${name}: ${outPath} (${size} KB)`);
}
