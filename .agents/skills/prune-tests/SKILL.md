---
name: prune-tests
description: Find low-signal tests with a two-vote reviewer swarm and delete them through the TypeScript AST.
disable-model-invocation: true
---

# Prune tests

Find _low-signal_ tests and delete them. A low-signal test costs CI time and flakes without catching bugs. [rubric.md](rubric.md) defines _signal_ and the delete and keep categories.

A deletion needs two votes. Two independent reviewers agree, or a third reviewer settles their split. `scripts/prune.ts` keeps the tally and makes every edit, so no test file is edited by hand.

## Commands

Run every command from the repo root. In this document, `$P` means `node <this skill's directory>/scripts/prune.ts`, and `$S` means `$(git rev-parse --absolute-git-dir)/prune-tests`. Git never commits `$S`.

- `$P list <file...>` prints each test's title path, line, and `.each` row count.
- `$P tally $S` merges the votes in `$S/pass1`, `$S/pass2`, and `$S/tiebreak`. It writes `needs-pass2.txt`, `disputed.json`, and `deletions.json`, and prints the next phase as `next`.
- `$P apply $S/deletions.json` deletes tests and table rows by title path. Then it deletes the imports and helpers that the deletions left unused, and deletes any file left with no tests.

The script loads the repo's `typescript`. If the repo is on TypeScript 7, which has no JS compiler API, install 5.x with `npm i --prefix /tmp/prune-ts typescript@5` and set `PRUNE_TS=/tmp/prune-ts/node_modules/typescript`.

## Reviewers

Send each reviewer a brief from [reviewer-prompt.md](reviewer-prompt.md). Run reviewers as read-only subagents in parallel waves. A reviewer replies with its output path only, so votes stay out of your context.

Run pass 1 on Sonnet. Run pass 2 on a different model family if the harness offers one, because reviewers on one model tend to share mistakes. Otherwise use fresh Sonnet reviewers. Run the tiebreak on the strongest model available.

## Steps

1. **Baseline.** Create the branch `prune-tests/<YYYY-MM-DD>` from an up-to-date default branch. Run the repo's test, typecheck, and lint scripts from `package.json`. Done when you have recorded the test wall time and every failing test.
2. **Discover.** Write the test files in scope to `$S/files.txt`, one repo-relative path per line. The scope is the path the user gave, else the whole repo:
   `mkdir -p $S && git ls-files <scope> | grep -E '\.(test|spec)\.[cm]?[jt]sx?$|/__tests__/.*\.[cm]?[jt]sx?$' > $S/files.txt`
   Then split it into batches of six: `mkdir -p $S/batches-1 && split -l 6 $S/files.txt $S/batches-1/`.
3. **Pass 1.** Send one pass brief per batch, with output `$S/pass1/<batch>.json`. Done when `tally` prints `"missingPass1": []`. Rerun a reviewer whose files are missing once. After a second miss, record those files as a gap.
4. **Pass 2.** Split `$S/needs-pass2.txt` into `$S/batches-2/` the same way. Send fresh reviewers the same pass brief, with output `$S/pass2/<batch>.json`. Only files with a pass 1 vote get this pass. Done when `tally` prints `"needsPass2": 0`.
5. **Tiebreak.** Group `$S/disputed.json` by file. Send one tiebreak brief per group, with output `$S/tiebreak/<n>.json`. Done when `tally` prints `"next": "apply"`.
6. **Apply.** Run `$P apply $S/deletions.json`, then run the repo's formatter on the touched files. An `unmatched` entry stays in the code and goes in the report as a gap. `leftoverUnused` lists helpers that are now unused but may have side effects, such as `vi.spyOn` calls. They stay in the code and go in the report.
7. **Verify.** Rerun the step 1 scripts. Done when no failure appears that the baseline did not have. If a touched file causes a new failure, restore it with `git restore <file>`, rerun the scripts, and record the file as a gap.
8. **Ship.** Commit, push, and open a PR. The body gives the deletion count per category, the test wall time before and after, the deleted files, and every gap.
