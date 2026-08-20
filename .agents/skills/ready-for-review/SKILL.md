---
name: ready-for-review
description: >-
  Use when a PR is ready for review.
---

# Ready for Review

Hand a finished PR to a reviewer, then stay on watch until the review concludes. The contract is **inbound only**: request the review, watch, hand new feedback to triage. Never send follow-up, re-request, or thank-you messages — whether a review round is done is the user's judgment call.

One reviewer per invocation. For a second reviewer, run the skill again.

## Inputs

- PR number (required). Ask if missing.
- Reviewer (optional second argument): a name or Slack handle.

## Workflow

### 1. Gather PR facts

```bash
gh pr view <n> --json title,body,url,state,isDraft,additions,deletions,changedFiles,reviewDecision
```

Stop with a note if the PR is already merged or closed.

### 2. Make it ready on GitHub

- If `isDraft`, flip it without asking — invoking this skill *is* the declaration that it's ready: `gh pr ready <n>`. Note the flip in the final output.
- Confirm the colleague's GitHub username with the user (once per invocation), then:

```bash
gh pr edit <n> --add-reviewer <github-username>
```

### 3. Slack DM

Resolve the colleague to a Slack user with `slack_search_users` — from the second argument if given, otherwise ask. Confirm the match with the user when more than one is plausible.

Compose a short DM: PR link and title, a one-sentence what-and-why derived from the PR body, and a size line so the reviewer can gauge effort. No diff excerpts.

```
Hey! <title> is ready for review: <url>
<one sentence on what it does and why>
Size: +X/−Y across N files. I've added you as reviewer on GitHub.
```

**Show the draft in the terminal and wait for the user's OK before sending.** Never send unseen. Send as a direct message, not to a channel.

### 4. Watch

Snapshot happens inside the watcher — launch it from this skill's directory with `run_in_background`:

```bash
scripts/watch-pr.sh <n>
```

It polls every 3 minutes and exits when anything changes: comments or reviews from anyone but the user (bots included — `evaluate-pr-comments` handles bot noise), or PR state/review decision. Slack replies are deliberately ignored; the PR is the source of truth.

When the watcher exits:

- **Exit 3** (quiet timeout): relaunch immediately, passing the printed baseline as the 4th argument (`scripts/watch-pr.sh <n> 180 540 '<baseline-json>'`). Produce no user-facing output.
- **Exit 0** (activity): go to step 5.

### 5. Prompt on activity

1. Diff the `before`/`after` counts in the watcher output, then fetch the actual new items via `gh` (unresolved-threads GraphQL lives in [evaluate-pr-comments REFERENCE.md](../evaluate-pr-comments/REFERENCE.md)).
2. If the change is a **termination event**, go to step 6 instead of prompting.
3. Fire one push notification: `PR #<n>: new review activity from <author>`.
4. Summarize in the terminal: who commented, on what, how much.
5. Ask the user (AskUserQuestion) — **Evaluate now / Keep watching / Stop**:
   - **Evaluate now** → invoke the `evaluate-pr-comments` skill with the PR number. When its report is done, start a new review round: relaunch the watcher with no baseline argument so it re-snapshots.
   - **Keep watching** → relaunch the watcher with the `after` signature as baseline.
   - **Stop** → final summary; done.

### 6. Terminate

End the watch with a final summary (no prompt) when:

- PR state is `MERGED` or `CLOSED`, or
- `reviewDecision` is `APPROVED` and no unresolved review threads remain.

An approval *with* unresolved threads is still activity — prompt as in step 5.

## Related skills

| Goal | Skill |
|------|-------|
| Request review + watch | `ready-for-review` |
| Judge incoming comments | `evaluate-pr-comments` |
| Fix + CI to merge | `babysit` |
