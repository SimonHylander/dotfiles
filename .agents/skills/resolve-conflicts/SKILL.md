---
name: resolve-conflicts
description: Resolve merge conflicts between a PR branch and its base, verify the result, and push. Use when a PR has merge conflicts, is out of date with its base, or the user invokes /resolve-conflicts.
---

# Resolve Conflicts

Bring a PR branch up to date with its base so it merges cleanly, keeping the intent of both sides. A resolution is done when every conflict is resolved with both sides' intent kept, the project's checks pass, and the merge commit is pushed.

## 1. Check out the PR

Take the PR number or URL from the user, or use the PR for the current branch. Ask if neither exists.

```bash
gh pr view <pr> --json number,headRefName,baseRefName,mergeable,url
```

If `git status` shows uncommitted changes, work in a separate worktree so the user's changes stay untouched:

```bash
git worktree add ../<repo>-conflicts-<pr> <headRefName>
```

Otherwise run `gh pr checkout <pr>`. Then `git pull` the head branch.

## 2. Merge the base

```bash
git fetch origin <baseRefName>
git merge origin/<baseRefName>
```

Merge, keeping the PR's history intact so pushing needs no force. Rebase only when the user asks for it. If the merge is clean, skip to step 4.

## 3. Resolve each conflict

List the conflicted files with `git diff --name-only --diff-filter=U`. For each conflict, learn why each side changed before editing:

```bash
git log --oneline origin/<baseRefName> ^HEAD -- <file>   # base-side commits
git log --oneline HEAD ^origin/<baseRefName> -- <file>   # PR-side commits
```

Read the relevant commits and the merge base version (`git show :1:<file>`). Then write the result that keeps both intents. Common shapes:

- **Both sides added** (imports, list entries, routes): keep both, ordered by the file's convention.
- **Base renamed or moved code the PR edited**: apply the PR's edit at the new name or location, and update every PR call site to the new name.
- **Base changed a signature the PR calls**: adapt the PR's calls to the new signature.
- **Lockfiles and generated files**: take the base version, then regenerate with the project's tool (`pnpm install`, codegen script, migration tooling).

A conflict is **ambiguous** when the two intents contradict and the code cannot tell which should win, such as both sides changing the same business rule to different values. Leave ambiguous conflicts unresolved and record them for the report.

Search the PR's new code for uses of anything the base removed or renamed. These break without showing as textual conflicts.

Completion: `git diff --check` and `rg -n '^(<{7}|={7}|>{7})'` find no markers, and every conflict is either resolved or recorded as ambiguous.

## 4. Verify

Run the project's typecheck, lint, and tests for the affected packages (find the commands in `package.json`, `Makefile`, or CI config). Fix failures caused by the merge. Failures that also occur on the base branch are pre-existing; note them and continue.

## 5. Finish

If any conflict is ambiguous, stop without committing. Leave the merge in progress and report.

Otherwise commit the merge with git's default message and push. Remove the worktree if step 1 created one.

## Output

```
PR: <url>
Result: pushed <sha> | stopped, needs decision

Resolved
- <file>: <how both intents were kept>

Needs decision
- <file:line>: <base intent> vs <PR intent>, options

Checks: <commands run and result, pre-existing failures noted>
```
