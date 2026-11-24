---
name: taste
description: Review or evaluate code or a system against Simon's engineering taste, or add a preference to it.
disable-model-invocation: true
---

# Taste

[TASTE.md](TASTE.md) holds Simon's preferences as numbered entries (`T1`, `T2`, ...). Read it in full before any step.

If the argument starts with `add`, follow [Add an entry](#add-an-entry). Otherwise review.

## Review

1. **Fix the target.** The target is what the argument names: a diff since a base, a path, a PR, or a described system. With no argument, use the current branch's diff against its merge-base with the default branch. Done when you can list every file or component in scope.
2. **Apply every entry.** Run each entry's check against every unit in scope. Done when every entry has a verdict: `pass`, `finding` with `file:line`, or `n/a` with the reason.
3. **Climb every finding.** For each finding, name the highest tier of the trust hierarchy that could catch it next time: a type, a lint rule, or a test. Done when every finding has a climb, or a reason it can only live in review.
4. **Report.** List findings as `F1`, `F2`, ... ranked by severity. Each states the entry it breaks, the location, the fix, and the climb. Close with one line per entry giving its verdict.

## Add an entry

1. Find the entry closest to the new preference. If one covers it, sharpen that entry instead of adding a second.
2. Otherwise append the next `T` number. Write the target as a positive statement and give it a check the reviewer can run against a diff.

Done when the preference lives in exactly one entry and that entry has a check.
