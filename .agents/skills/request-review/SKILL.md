---
name: request-review
description: Add a reviewer to a GitHub PR. Use when the user names a person or team to review a PR.
---

# Request Review

Request a review from one person or team on a GitHub PR. The review request is the only change you make.

## Inputs

- **Reviewer**: a GitHub login (`octocat`), a team (`org/team`), or a display name. Required.
- **PR**: a number or URL. If omitted, `gh` uses the PR for the current branch.

## Steps

1. If the reviewer is a display name, resolve it to a login. This query matches both login and name:

   ```sh
   gh api graphql -f o=<owner> -f r=<repo> -f q=<name> -f query='
     query($o:String!,$r:String!,$q:String!){repository(owner:$o,name:$r){
       assignableUsers(query:$q,first:5){nodes{login name}}}}'
   ```

   Done when exactly one login matches. With zero or several matches, ask the user which login to use.
2. Run `gh pr edit [<pr>] --add-reviewer <login-or-team>`.
3. Run `gh pr view [<pr>] --json url,reviewRequests`. Done when the reviewer appears in `reviewRequests`.

## Gotchas

- GitHub rejects the PR author as a reviewer. Tell the user and stop.
- Team reviewers need the `read:org` token scope. If `gh` reports a missing scope, tell the user to run `gh auth refresh -s read:org`.

Report the PR URL and the reviewer's login in one line.
