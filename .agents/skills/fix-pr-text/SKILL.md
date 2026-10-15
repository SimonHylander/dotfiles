---
name: fix-pr-text
description: "Rewrite the prose in a filed PR (title, description, code comments, docs) for readability using the technical-writing standard. Use for /fix-pr-text after a PR is filed."
disable-model-invocation: true
---

# Fix PR text

Make the text in a PR easier to read. Text only. Never change behavior.

## Inputs

- PR number (optional). Default: the PR for the current branch (`gh pr view`).

## Workflow

1. Invoke the `technical-writing` skill and follow it for every edit below.
2. Get the PR text and the diff:

```bash
gh pr view <n> --json number,title,body,headRefName
gh pr diff <n>
```

3. Scope to what the PR added or changed:
   - Comments and docstrings on added or modified lines.
   - Markdown and doc files the PR touches.
   - Error messages, log strings, and CLI help text the PR adds.
   - The PR title and body.
4. Edit the files in place. Leave unchanged lines, code, identifiers, and user-facing product copy alone. Keep comments in sync with the code they describe, and delete comments that restate the code.
5. Rewrite the PR title and body with `gh pr edit <n>`. Keep every fact, link, and ticket reference. Remove the Claude watermark and co-author lines if present.
6. Commit text-only changes in one commit (`Improve PR text`) and push. Do not ask first.

## Output

Two lines at most: what changed (files touched, title/body rewritten or not) and anything you left because rewriting it would change meaning.
