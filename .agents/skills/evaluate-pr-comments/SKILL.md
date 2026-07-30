---
name: evaluate-pr-comments
description: >-
  Evaluate open pull request review comments for validity, factual correctness,
  and whether they are in scope for the PR. Use when triaging PR feedback,
  responding to review threads, validating Bugbot or bot comments, deciding what
  to fix before merge, or when the user asks to evaluate, validate, or assess PR
  comments.
---

# Evaluate PR Comments

Assess **open, unresolved** PR feedback before acting on it. Separate real in-scope work from false positives, misunderstandings, and follow-up items. Do not implement fixes unless the user asks. For merge-ready triage after evaluation, use `babysit`.

## Inputs

- PR number or URL
- Optional: `owner/repo` when not inferable from context or URL
- Optional: stated intent when the PR description is thin

Ask for the PR if missing.

## Workflow

### 1. Establish intent

Derive a one-sentence scope statement from PR description → linked Linear issue → title → user clarification. Reuse the `scope-check` intent workflow. Do not guess when intent is still ambiguous.

### 2. Gather open comments

Fetch PR metadata and diff:

```bash
gh pr view <n> --json title,body,headRefName,baseRefName,url,state
gh pr diff <n>
```

Fetch **unresolved** inline threads via GraphQL — see [REFERENCE.md](REFERENCE.md). Skip resolved threads. Scan top-level PR comments for change requests not on a thread. Read only bodies and minimal path/line/URL context.

Checkout `headRefName` when full-file context is needed:

```bash
git fetch origin && git checkout <headRefName>
```

### 3. Evaluate each comment

Inspect cited code (plus callers/tests when needed). Judge three axes:

| Axis | Question |
|------|----------|
| Validity | Real bug, risk, spec gap, or maintainability issue? |
| Correctness | Does the comment match what the code does today? |
| Scope | Fix in this PR, or defer to follow-up? |

When present, read `.cursor/rules/code-guidelines.mdc` and `gathering-context-guidelines.mdc` before judging correctness.

Flag likely false positives: stale line references, disproved assumptions, repo patterns the comment ignores, bot noise on generated/config files, refactors with no feature or safety value in this PR.

### 4. Verdict

One per thread or distinct comment:

| Verdict | When |
|---------|------|
| `accept` | Valid, correct, in scope — address before merge |
| `acknowledge` | Valid optional improvement; non-blocking |
| `defer` | Valid but out of scope for this PR |
| `dispute` | Invalid or factually wrong |
| `unclear` | Cannot verify without reviewer input |
| `resolved` | Already fixed on the branch |

Prefer `acknowledge` over `accept` for low-severity valid feedback.

### 5. Report

```markdown
**Scope statement:** This PR is intended to [do X] in [area Y].
**Open comments reviewed:** N

### Summary
accept: N | acknowledge: N | defer: N | dispute: N | unclear: N | resolved: N

### Findings

#### `path:line` — @author
- **Verdict:** …
- **Validity / Correctness / Scope:** brief per axis
- **Suggested response:** one sentence for the author
```

Order: `accept` and `dispute` first, then `defer`, `acknowledge`, `unclear`, `resolved`.

## Related skills

| Goal | Skill |
|------|-------|
| Judge comments | `evaluate-pr-comments` |
| Fix + CI to merge | `babysit` |
| Judge diff breadth | `scope-check` |
| Review the code | `review-pr` / `review-local` |
