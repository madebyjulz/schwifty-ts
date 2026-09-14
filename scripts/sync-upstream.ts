/**
 * Bring the `schwifty-py` submodule up to date and report what needs porting.
 *
 *   node scripts/sync-upstream.ts            # latest upstream tag
 *   node scripts/sync-upstream.ts main       # tip of upstream main
 *   node scripts/sync-upstream.ts 2026.07.3  # a specific tag or commit
 *
 * Steps:
 *   1. fetch upstream and check out the requested revision in the submodule,
 *   2. print the upstream commits and source diff since the revision recorded
 *      under `schwifty.upstream` in package.json,
 *   3. regenerate `src/data`,
 *   4. record the new revision in package.json.
 *
 * Reviewing the printed diff and porting it to `src/` is still a manual step;
 * the changelog entry should reference the recorded upstream revision.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const projectRoot = path.join(import.meta.dirname, "..");
const submodule = path.join(projectRoot, "schwifty-py");
const packageJsonPath = path.join(projectRoot, "package.json");

/** The upstream paths whose changes have to be ported (everything else is packaging). */
const PORTED_PATHS = ["schwifty", "tests", "CHANGELOG.rst"];

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

// oxlint-disable-next-line typescript/no-unsafe-type-assertion
const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8")) as PackageJson;
const previous = packageJson.schwifty.upstream;

git(["fetch", "--tags", "--prune", "origin"]);
const requested = process.argv[2] ?? latestTag();
const target = requested === "main" ? "origin/main" : requested;
git(["checkout", "--quiet", "--detach", target]);
const current = git(["rev-parse", "HEAD"]);

console.log(`upstream: ${previous.slice(0, 7)} -> ${current.slice(0, 7)} (${tagFor("HEAD")})`);

if (current === previous) {
  console.log("Already up to date.");
} else {
  console.log("\nCommits to port:\n");
  console.log(
    git(["log", "--oneline", "--date=short", "--format=%h %ad %s", `${previous}..${current}`, "--", ...PORTED_PATHS]),
  );
  console.log("\nSource diff:\n");
  console.log(git(["diff", "--stat", previous, current, "--", ...PORTED_PATHS]));
  console.log("\nRun `git -C schwifty-py diff <previous> <current> -- schwifty tests` for the full diff.\n");
}

execFileSync("node", [path.join(projectRoot, "scripts", "consolidate-registry.ts")], {
  cwd: projectRoot,
  stdio: "inherit",
});

packageJson.schwifty = { upstream: current, upstreamTag: tagFor("HEAD") };
writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Recorded upstream ${current.slice(0, 7)} in package.json.`);
