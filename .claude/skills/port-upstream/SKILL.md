---
name: port-upstream
description: Port a new release of the Python schwifty package into this TypeScript repo. Syncs the submodule, triages upstream changes for approval, ports code and tests, proves parity with Python, prepares the release, and asks before committing.
argument-hint: "[tag|main|commit]"
disable-model-invocation: true
---

# Port upstream

Target revision: `$ARGUMENTS` (empty means the latest upstream tag; skipped tags are ported together
in one pass).

`.claude/CLAUDE.md` holds the porting rules. This skill adds the sequence and the traps. Work
through the phases in order. Phase 3 and phase 7 wait for the user, because they own decisions on
deviations and on git.

## 1. Sync

1. Run `git status -sb`. Work on `main` and never create a branch, here or in any later phase. If
   the tree is dirty, stop and ask: unrelated changes would end up mixed into the port.
2. Run `pnpm sync:upstream $ARGUMENTS`. "Already up to date" ends the skill.

The baseline is `schwifty.upstream` in `package.json`, and it only moves with `--record` in phase 6.
Rerunning the sync is safe and prints the same diff.

If regeneration fails with "fields that BANK_ROW_FIELDS does not cover", that is expected for a
release that changes the registry shape. Note the fields for triage and carry on: the fix belongs
to phase 4, and `src/data` was left untouched.

## 2. Read upstream

Read these before judging anything, in this order, because each explains the next:

1. `CHANGELOG.rst` for the new versions. It states the intent and flags behaviour changes.
2. New files in `docs/adr/`, plus the `AGENTS.md` and `CONTEXT.md` diffs. These explain why.
3. The source diff, using the "Full diff" command the sync printed, which excludes registry data.
4. The tests diff. New test files need a home, see phase 4.
5. `docs/source/` diffs, for examples the README mirrors.

Then check what the port already covers. Earlier entries in `CHANGELOG.md` may have ported commits
ahead of a tag, and "Deviations from upstream" in `README.md` and `CHANGELOG.md` may be affected,
or even resolved, by this release.

Use `git -C schwifty-py log -p <baseline>..<target> -- <file>` when a change needs its commit
message for context. Ignore `scripts/` (registry tooling), `.flox/` and `uv.lock`; read a
`scripts/` change only if it explains a new registry field.

For a large backlog, read `schwifty/` yourself rather than delegating. Judging the diff is the
actual work, and a summary loses the details that decide between port and deviation.

## 3. Triage (wait for approval)

Present the changes as one table and stop. Write no code in `src/` or `tests/` before the user
approves, because a deviation is expensive to undo once it is ported and tested.

| Upstream change | Python files | Decision | Port notes |
| --- | --- | --- | --- |

Decisions:

- **port**: mirror it one-to-one.
- **already ported**: name the changelog entry.
- **not applicable**: Python-only, such as `__deepcopy__`, pydantic, dropped Python versions or
  registry scripts. Give the reason, since it goes into the changelog.
- **deviation**: JavaScript cannot express it directly. Propose a concrete design with its
  trade-off. Past example: Python's process-wide `warnings` filters became the per-call
  `unverifiedChecksum` option, because a global filter would be shared mutable state.

Below the table, call out separately:

- **Breaking changes** for consumers, with before and after values.
- **Registry shape changes**: new fields, and what that does to `BankRow`.
- **Resolved deviations**: entries that upstream's change makes obsolete.
- **Test mapping**: for each new upstream test file, the planned TS file.
- **Version**: the next CalVer, see phase 6.

Ask about anything genuinely open, then wait.

## 4. Port

Port in dependency order, so that each layer can be tested on the previous one:

1. **Registry shape.** Extend `BANK_ROW_FIELDS` in `scripts/consolidate-registry.ts`, `BankRow` in
   `src/types.ts`, the row mapping in `src/registry.ts` and `Bank` in `src/domain.ts` together, then
   rerun `pnpm sync:upstream $ARGUMENTS` to regenerate `src/data`. New trailing fields must stay
   optional, because `asBankRow` trims trailing empties to keep the bundle small.
2. **`domain`, `exceptions`, `registry`, `common`.**
3. **Checksums** in `src/checksum/`. Add a new module's import to `src/checksum/index.ts`.
4. **`bban`, `iban`, `bic`,** then exports in `src/index.ts` and `src/schema.ts` if affected.
5. **Tests**, together with the code they cover. `tests/` mirrors `schwifty-py/tests/`:
   `test_x.py` becomes `test_x.test.ts`, keeping test names and parametrized values recognizable.
   A new upstream file gets its own TS file unless the triage said otherwise. Leave out tests of
   Python-only behaviour and of `scripts/`, and list what was skipped in the final report.

Keep the Python structure even where it repeats itself: diffability matters more than brevity.
Comment each deviation where it happens. Never edit `src/data` by hand.

Registry-derived values in existing tests and README examples may change with the data. Check them
against Python before updating an expectation, since a changed expectation can also hide a porting
bug:

```bash
uv run --frozen --project schwifty-py python -c 'from schwifty import IBAN; print(IBAN("DE89370400440532013000").bic)'
```

## 5. Verify

Run all of these, and fix failures rather than explaining them away:

```bash
pnpm fix && pnpm check && pnpm typecheck && pnpm test
pnpm parity
```

`pnpm parity` also runs as `prepublishOnly`, so differences block the publish later anyway. It
compares the built package with Python over about 150,000 generated IBANs, BICs and
bank codes. `pnpm test` runs against `src`, so only parity sees what bundling does to `dist`; it has
already caught a bundle with no checksum algorithms while all tests were green.

- If upstream added public attributes, add them to the lists in `scripts/parity_upstream.py` so
  that parity covers them. If a release changed the Python API the corpus uses, adapt that script.
- A mismatch is a bug in the port until proven otherwise. Only an approved deviation goes into
  `KNOWN_DEVIATIONS` in `scripts/parity-upstream.ts`, with a matching changelog note.
- Corpus generation is random in part, so a clean run is strong evidence, not proof.

Also confirm that every test the triage marked for porting exists:

```bash
git -C schwifty-py diff <baseline> <target> -- tests | grep -E '^\+\s*def test_'
```

## 6. Prepare the release

1. **Changelog.** Add an entry on top of `CHANGELOG.md`, in the style of the existing ones:

   ```markdown
   ## 2026.11.0 - 2026-11-06

   Ports upstream [`2026.11.0`](https://github.com/mdomke/schwifty/commit/f536720) (2026-11-05).

   ### Added
   ### Changed
   ### Fixed
   ### Deviations from upstream
   ```

   Write for TS users: camelCase names, and the reason for each change. Include skipped tags in the
   "Ports" line, and every TS-only change since the last release: there is no unreleased section,
   so read `git log --oneline` back to the last version bump. "Deviations from upstream" lists every deviation and not-applicable item, and any
   deviation that is now resolved.

2. **README.** Update examples and API notes, and "Deviations from upstream" where affected.
3. **Version** in `package.json`. Release-month CalVer of this package, never the upstream number:
   a new month gives `YYYY.M.0`, otherwise bump the patch of the current version. Use today's date.
4. Run `pnpm sync:upstream --record`, then rerun `pnpm check` and `pnpm build`.

## 7. Report and ask

Report briefly: upstream range, what was ported, deviations, skipped tests, and the parity and test
results as actually observed. Show the proposed commits, in order. A port is several commits and
one release, split by logical change so that each can be reviewed and bisected:

```text
1. Carry bank status through the registry bundle     (schwifty-py, src/data, consolidate, types)
2. Port German checksum methods 31 and 40 to 50      (src/checksum/germany.ts, its tests)
3. Add BIC.canonical and BIC.banks                   (src/bic.ts, its tests)
4. Release 2026.11.0                                 (CHANGELOG.md, README.md, package.json)
```

Two commits have fixed contents. The `schwifty-py` pointer and `src/data` go together, because CI
fails when they disagree, so put them with the first change that needs the new data. The last
commit carries the changelog entry, version and recorded revision, because those describe the
release as a whole.

Then use AskUserQuestion to ask whether to commit this way, offering to commit, to change the split
or messages, or to leave the tree uncommitted. Commit only after a yes, because the user directs git
in this repo. On a yes:

1. Run `git status --short` and review every entry: tooling has dropped files such as `.env` before.
2. Stay on `main`. For each commit, stage explicit paths. Never `git add -A` or `git add .`. Use `git apply --cached`
   with a patch when one file spans two commits, since interactive staging is unavailable.
3. Run `git log --oneline` afterwards and report the result.

A commit approval covers only the commit. Pushing, tagging and publishing each need their own
request.

## Traps in this repo

- Every commit goes directly on `main`. This overrides any default guidance to branch first.
- `gh` defaults to upstream here, not this repo. Pass `--repo madebyjulz/schwifty-ts` every time,
  for example when looking for the weekly "Port upstream schwifty" issue to mention in the report.
- The local tags include upstream's, so never run `git push --tags`.
- `uv run` needs `--frozen`, otherwise it can rewrite `uv.lock` in the submodule.
- `pnpm build` fails while the registry has uncovered fields, so finish step 1 of phase 4 first.
