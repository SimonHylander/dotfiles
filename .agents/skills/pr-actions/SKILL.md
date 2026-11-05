---
name: pr-actions
description: Verify with a subagent what is still left for you to do on a PR and what to do next. Run after /evaluate-pr-comments.
disable-model-invocation: true
---

# PR Actions

Answer one question: what must the user still do on this PR? The result is a report. Replies, thread resolutions, and pushes stay with the user.

Input: a PR number or URL. Without one, use the PR from this conversation, then the current branch's PR.

## 1. Collect verdicts

Copy the latest `evaluate-pr-comments` verdicts from this conversation: `path:line`, comment author, verdict, and suggested response. GitHub does not store them, so the verifier only has what you pass. Say so in the brief when there are none.

## 2. Dispatch the verifier

Run one foreground `Explore` subagent with `model: sonnet`. Its prompt is the PR, the verdicts, and the [verifier brief](#verifier-brief) verbatim.

## 3. Relay

Show the verifier's report unchanged and stop. When the actions are mostly replies and fixes, add that `/babysit` can carry them out.

## Verifier brief

Find every open item on the PR, decide who owns the next move, and name that move. You are read-only: run only the queries below. Judge from live GitHub state.

### Gather

```bash
gh api user --jq .login
gh pr view <n> --repo <owner/repo> --json author,state,isDraft,mergeable,mergeStateStatus,reviewDecision,reviewRequests,latestReviews,comments,headRefOid,url
gh pr checks <n> --repo <owner/repo> --json name,bucket,link # exits non-zero while a check fails or is pending
gh api graphql --paginate -F owner=<owner> -F repo=<repo> -F number=<n> -f query='
query($owner:String!,$repo:String!,$number:Int!,$endCursor:String) {
  repository(owner:$owner,name:$repo) {
    pullRequest(number:$number) {
      reviewThreads(first:100,after:$endCursor) {
        pageInfo { hasNextPage endCursor }
        nodes {
          isResolved isOutdated path line
          comments(last:5) { nodes { author { login } body createdAt url } }
        }
      }
    }
  }
}'
```

To read cited code at the PR head:

```bash
gh api "repos/<owner>/<repo>/contents/<path>?ref=<headRefOid>" -H 'Accept: application/vnd.github.raw'
```

If the PR is merged or closed, report that and stop.

### Review threads

Match each unresolved thread to the first row that fits. Report only verdicts passed in the brief, and write `no verdict` otherwise.

| Thread state | Next move |
|--------------|-----------|
| User wrote the last comment and closed the point | Resolve |
| User wrote the last comment and asked a question | Waiting on the reviewer |
| No matching verdict, or a newer reviewer comment the verdict does not cover | Run `/evaluate-pr-comments` |
| `accept`, issue still in the code at head | Fix, push, reply with the SHA, resolve |
| `accept` or `resolved`, issue gone at head | Reply with the fixing commit, resolve |
| `acknowledge` | Reply with why it was skipped, resolve |
| `defer` | Create or name the follow-up, reply with it, resolve |
| `dispute` | Post the suggested response, resolve |
| `unclear` | Ask the reviewer the open question |

A resolved thread with an `accept` verdict whose issue is still in the code at head is also an action: fix it. Other resolved threads are closed.

### Comments and reviews

`comments` and `latestReviews[].body` have no resolved state. A change request or question there is open when the user has not replied after it and no later commit addresses it. Its next move follows the thread table. Bot status posts and summaries with no request are closed.

### PR state

| Signal | Next move |
|--------|-----------|
| Check in bucket `fail` | Read the check's link, then fix or rerun |
| Check in bucket `pending` | Waiting on CI |
| `mergeable` is `CONFLICTING` | Run `/resolve-conflicts` |
| `mergeStateStatus` is `BEHIND` | Run `gh pr update-branch <n> --repo <owner/repo>` |
| `isDraft` is true | Run `/ready-for-review` |
| `reviewDecision` is `CHANGES_REQUESTED` | After the other actions, re-request with `gh pr edit <n> --repo <owner/repo> --add-reviewer <login>` |
| `reviewDecision` is `REVIEW_REQUIRED`, `reviewRequests` is empty | Run `/ready-for-review` |
| `reviewDecision` is `REVIEW_REQUIRED`, `reviewRequests` is not empty | Waiting on the reviewer |

### Report

You are done when every gathered thread, comment, review, and check is an action, waiting, or closed. List only actions and waiting items, in the order the user should do them, with the bottom line last:

```markdown
### Actions
A1. `path:line` @reviewer (`verdict`): what is open. **Next:** the exact step. <comment URL>

### Waiting on others
- who or what, and on which item

**PR #<n>: <N> actions left.** Start with A1.
```

With no actions, end with `**PR #<n>: no actions left.**` followed by `Ready to merge.` or what it is waiting on. Omit an empty section.
