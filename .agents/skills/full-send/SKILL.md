---
name: full-send
description: Prove a PR works by running it, score confidence against a fixed rubric, and merge at 9/10 or higher.
disable-model-invocation: true
---

# Full send

Treat the PR as broken until a run proves otherwise. Every claim that it works gets **proof**: real code executed with its output captured. Reading code is a lead, never proof. Merge only when the evidence scores 9/10 or higher.

Input: a PR number or URL. Default to the PR for the current branch.

## 1. Set up

```bash
gh pr view <n> --json number,title,body,headRefName,baseRefName,mergeable,state,url
```

Work on the PR head. Use the current checkout when it is clean and on the head branch. Otherwise make a worktree of the head branch.

## 2. List the risks

Read the diff and the code it touches. Write down:

- **Claims**: what the PR says it makes true. Each becomes something to prove.
- **Risks**: each way the change could break something outside its own lines. Look past the diff at callers, data shapes, config, migrations, wire formats, timing, and the versions of dependencies it calls.
- **The safety fact**: the single fact most risks clear on, such as "this branch only runs when the flag is set". Proving it clears many risks at once.

## 3. Prove each one

For every claim and risk, get the strongest proof that is reachable, in this order:

1. Exercise it in the running app or system. Use the `run` skill to launch it.
2. A script or test that calls the real code and fails loudly when the claim is false.
3. The existing test suite, after confirming that a test covers this path.
4. CI checks on the head commit: `gh pr checks <n> --watch`.

When the repo has no harness for a path, build the smallest one that exercises it. Run every check, and keep the command and its decisive output. A failing check is a finding: fix it on the branch when the fix is clear, then prove it again.

Commit a new test when it guards behaviour the PR adds. Keep throwaway probes out of the PR.

## 4. Score

Score the evidence, not your impression of the code:

| Score | Evidence |
|-------|----------|
| 10 | Every claim and risk proven by running code, and the change exercised end to end in the running system. CI green. |
| 9 | Every claim and risk on the change's path proven by running code. CI green. What is left unproven is outside the change's reach, and you can name it. |
| 7-8 | Checks pass, but at least one risk is cleared only by reading code. |
| 6 or lower | A check fails, or a risk has no check. |

A risk you could not prove pins the score at 8 or lower, whatever else passed.

## 5. Merge at 9 or higher

Merge when all of these hold:

- Score 9 or higher.
- Every check on the head commit passed, including commits you pushed in step 3.
- `mergeable` is `MERGEABLE`, and no review thread is unresolved.

```bash
gh pr merge <n> --squash --delete-branch
```

Use `--merge` or `--rebase` when the repo disallows squash. After merging, watch the base branch's CI run for the merge commit. If it fails, report it at the top.

Below 9, leave the PR open. Name what keeps the score down and the cheapest check that would raise it.

## Report

A table of each claim and risk with its proof: the command, or the test and its result. Then the score and the reason. End with the outcome: merged with the merge SHA, or not merged and why.
