---
name: assign-review
description: Request a review from a given person on a GitHub PR. Use when the user says "assign review", "add <person> as reviewer", or invokes /assign-review.
---

# Assign Review

Add the given person as a reviewer on a GitHub PR. Do nothing else.

## Inputs

- **Reviewer**: a GitHub login (`octocat`) or a team (`org/team`). Required.
- **PR**: a number or URL. If omitted, use the PR for the current branch.

## Steps

1. If the reviewer is a display name, not a login, resolve it with
   `gh api repos/{owner}/{repo}/collaborators --paginate --jq '.[].login'`
   and pick the matching login. If no single match exists, ask the user.
2. Run `gh pr edit [<pr>] --add-reviewer <reviewer>`.
3. Confirm with `gh pr view [<pr>] --json url,reviewRequests`.

Report the PR URL and the reviewer in one line.
