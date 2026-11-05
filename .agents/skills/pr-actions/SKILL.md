---
name: pr-actions
description: Verify what is still left for you to do on a PR and what to do next. Run after /evaluate-pr-comments.
disable-model-invocation: true
---

# PR Actions

Verify what the user still has to do on this PR, and name the next step for each item. The report is the whole job, so replies, thread resolutions, and pushes stay with the user.

Work from this conversation: the PR, the `evaluate-pr-comments` verdicts, and what has happened since. Query GitHub only for what the conversation cannot confirm, such as new comments or check results.

## Next steps

| Open item | Next step |
|-----------|-----------|
| Comment with no verdict | Run `/evaluate-pr-comments` |
| `accept`, not fixed yet | Fix, push, reply with the SHA, resolve |
| `accept` fixed, or `resolved` | Reply with the fixing commit, resolve |
| `acknowledge`, `defer`, `dispute` | Reply with the reason or follow-up, resolve |
| `unclear` | Ask the reviewer the open question |
| Reply posted, thread still unresolved | Resolve |
| Failing check | Read its log, then fix or rerun |
| Merge conflict | Run `/resolve-conflicts` |
| Draft, or no reviewer assigned | Run `/ready-for-review` |
| Changes requested, nothing above left | Re-request review |

Anything else open is waiting on someone else, such as a pending check or a reviewer's reply.

## Report

You are done when every unresolved thread, open comment, review, check, and merge blocker is an action or a waiting item. List them in the order the user should do them, with the bottom line last. Omit an empty section.

```markdown
### Actions
A1. `path:line` @reviewer (`verdict`): what is open. **Next:** the exact step. <comment URL>

### Waiting on others
- who or what, and on which item

**PR #<n>: <N> actions left.** Start with A1.
```

With no actions, end with `**PR #<n>: no actions left.**` followed by `Ready to merge.` or what it is waiting on.
