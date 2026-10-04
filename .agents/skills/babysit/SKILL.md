---
name: babysit
description: Watch a PR through review rounds, fix valid comments, and approve it once it is ready to merge.
disable-model-invocation: true
---

# Babysit

Drive one PR to mergeable. Input: a PR number or URL. Ask if missing.

Work in a worktree of the PR's head branch so the user's checkout stays untouched.

## 1. Triage

Run the `evaluate-pr-comments` skill on the PR. Then act on every verdict:

| Verdict | Action |
|---------|--------|
| `accept` | Fix it, run the affected tests, commit, push. Reply with the commit SHA and what changed. |
| `acknowledge` | Skip the fix. Reply with one line saying why. |
| `dispute`, `defer` | Reply with the reason. For `defer`, name the follow-up. |
| `resolved` | Reply with the commit that fixed it. |
| `unclear` | Stop and ask the user. |

Resolve each thread after replying:

```bash
gh api repos/<owner>/<repo>/pulls/<n>/comments/<comment id>/replies -f body='<reply>'
gh api graphql -f query='mutation($id:ID!){resolveReviewThread(input:{threadId:$id}){thread{isResolved}}}' -f id=<thread id>
```

If other PRs stack on this branch, rebase them onto it and push with `--force-with-lease`.

## 2. Wait for the next round

Bot reviewers post when their check finishes, so wait on the head commit's checks:

```bash
gh pr checks <n> --watch
```

Go back to step 1. Leave the loop when a triage on the current head finds nothing to act on.

## 3. Check readiness

The PR is ready when all of these hold on the head commit:

- No unresolved review threads.
- Every check finished and passed.
- `gh pr view <n> --json mergeable` is not `CONFLICTING`.
- Typecheck and tests pass. Run them in the worktree when CI does not.

Open PRs lower in the stack do not block.

## 4. Approve

```bash
gh pr review <n> --approve --body '<one line on why it is ready>'
```

GitHub refuses approval from the PR's author. In that case report the PR as ready.

## Stop and ask

Hand the decision to the user when:

- A fix needs a product or design decision.
- A reviewer raises an issue again after you fixed it.
- A check fails for a reason outside the PR.

## Report

List each comment's verdict and the commit or reply that closed it. End with the outcome: approved, ready but self-authored, or blocked and why.
