/**
 * Bring the `schwifty-py` submodule up to date and report what needs porting.
 *
 *   node scripts/sync-upstream.ts            # latest upstream tag
 *   node scripts/sync-upstream.ts main       # tip of upstream main
 *   node scripts/sync-upstream.ts 2026.07.3  # a specific tag or commit
 *   node scripts/sync-upstream.ts --record   # after porting: record the submodule revision
 *
 * Syncing fetches upstream, checks out the requested revision in the submodule,
 * prints the commits and source diff since the revision recorded under
 * `schwifty.upstream` in package.json, and regenerates `src/data`.
 *
 * The recorded revision is the baseline of the diff, so it only moves with
 * `--record`, once the port is done. Until then a rerun prints the same diff.
 *
 * Regenerating fails when the registry gained fields that the bundle does not
 * cover yet. The diff is printed first, and `src/data` stays as it was.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "..");
const submodule = path.join(projectRoot, "schwifty-py");
const packageJsonPath = path.join(projectRoot, "package.json");

/** The upstream paths that matter for a port (everything else is packaging or registry tooling). */
const PORTED_PATHS = ["schwifty", "tests", "CHANGELOG.rst", "docs/adr", "docs/source", "AGENTS.md", "CONTEXT.md"];

/** Registry data reaches the port through `src/data`, and its diff would drown out the source diff. */
const REGISTRY_EXCLUDES = [":(exclude)schwifty/bank_registry", ":(exclude)schwifty/iban_registry"];

interface PackageJson {
  schwifty: { upstream: string; upstreamTag: string };
  [key: string]: unknown;
}

function git(args: string[], cwd = submodule): string {
  return execFileSync("git", args, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
}

function latestTag(): string {
  const tags = git(["tag", "--list", "--sort=-version:refname"]).split("\n");
  const [latest] = tags;
  if (!latest) {
    throw new Error("Upstream has no tags");
  }
  return latest;
}

function tagFor(revision: string): string {
  try {
    return git(["describe", "--tags", "--exact-match", revision]);
  } catch {
    return git(["describe", "--tags", "--always", revision]);
  }
}

function readPackageJson(): PackageJson {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageJson;
}

function printPendingChanges(previous: string, current: string): void {
  const paths = [...PORTED_PATHS, ...REGISTRY_EXCLUDES];
  const pathspec = paths.map((entry) => `'${entry}'`).join(" ");
  const registryFiles = git([
    "diff",
    "--name-only",
    previous,
    current,
    "--",
    "schwifty/bank_registry",
    "schwifty/iban_registry",
  ]);

  console.log("\nCommits to port:\n");
  console.log(
    git(["log", "--oneline", "--date=short", "--format=%h %ad %s", `${previous}..${current}`, "--", ...PORTED_PATHS]),
  );
  console.log("\nSource diff (without registry data):\n");
  console.log(git(["diff", "--stat", previous, current, "--", ...paths]));
  console.log(`\nRegistry files changed: ${registryFiles ? registryFiles.split("\n").length : 0}`);
  console.log(`\nFull diff: git -C schwifty-py diff ${previous.slice(0, 7)} ${current.slice(0, 7)} -- ${pathspec}\n`);
}

function regenerateRegistry(): void {
  try {
    execFileSync("node", [path.join(projectRoot, "scripts", "consolidate-registry.ts")], {
      cwd: projectRoot,
      stdio: "inherit",
    });
  } catch {
    console.error("\nsrc/data was not regenerated. Fix scripts/consolidate-registry.ts, then rerun this script.");
    process.exitCode = 1;
  }
}

function sync(revision: string | undefined): void {
  const previous = readPackageJson().schwifty.upstream;

  git(["fetch", "--tags", "--prune", "origin"]);
  const requested = revision ?? latestTag();
  const target = requested === "main" ? "origin/main" : requested;
  git(["checkout", "--quiet", "--detach", target]);
  const current = git(["rev-parse", "HEAD"]);

  console.log(`upstream: ${previous.slice(0, 7)} -> ${current.slice(0, 7)} (${tagFor("HEAD")})`);
  if (current === previous) {
    console.log("Already up to date.");
  } else {
    printPendingChanges(previous, current);
  }
  regenerateRegistry();
  if (current !== previous) {
    console.log("Port the diff, then run `pnpm sync:upstream --record`.");
  }
}

function record(): void {
  const packageJson = readPackageJson();
  const current = git(["rev-parse", "HEAD"]);
  packageJson.schwifty = { upstream: current, upstreamTag: tagFor("HEAD") };
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  console.log(`Recorded upstream ${current.slice(0, 7)} (${packageJson.schwifty.upstreamTag}) in package.json.`);
}

const [argument] = process.argv.slice(2);
if (argument === "--record") {
  record();
} else {
  sync(argument);
}
