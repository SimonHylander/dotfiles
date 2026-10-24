---
name: full-stop
description: Take a change all the way to merge-ready without asking anything, and return only with a ready or dead-end verdict.
disable-model-invocation: true
---

# Full stop

Run **unattended** from the task to the edge of merge. The user is away. Make every decision yourself, and return with exactly one **verdict**:

- **READY**: the PR scores 9/10 or higher under the `full-send` rubric, every check passed, it is mergeable, and no review thread is unresolved.
- **DEAD END**: the change cannot work, shown by a failing run or a cited hard constraint, such as an API that lacks the capability, at a `file:line` or doc URL. A missing credential or access you cannot obtain counts. Name what would unblock it.

Everything short of merging is yours to do: branch, commit, push, open and update the PR, fix review comments. Leave the merge to the user.

Input: a task, a branch, or a PR.

## 1. Frame

Write the goal as a checkable statement of what must be true when the change works. This is the bar for both verdicts.

When a choice needs product judgement, pick the option that is smallest and easiest to reverse. Log it as a decision.

## 2. Build

Implement the change, or finish it, when the input is not already a complete change. Run the affected checks and commit.

## 3. Review

Read [`../sol-loop/SKILL.md`](../sol-loop/SKILL.md) and run it to the end. The PR is now filed.

## 4. Validate

Read [`../full-send/SKILL.md`](../full-send/SKILL.md) and run steps 1 to 4. Skip step 5: never merge.

Triage any review comments on the PR with the `evaluate-pr-comments` skill. Fix the accepted ones and reply on every thread.

## 5. Iterate

When the score is below 9, fix what keeps it down and go back:

- The fix changes behaviour: go to step 3.
- The fix only adds tests or proof: go to step 4.

Each cycle must change code, tests, or approach. When a cycle would change nothing, end in a verdict. After two distinct approaches fail on the same blocker, test whether it is a dead end, and prove it if it is.

## 6. Return

Send a push notification with the verdict and the PR URL.

## Report

1. **Decisions made without you**: one line each, `D1`, `D2`, and so on, with the reason.
2. **Evidence**: the `full-send` table and score for READY. For DEAD END, the blocker with its proof, and each approach tried with why it failed.
3. **Verdict**: READY or DEAD END, and the PR URL. Put this last.
