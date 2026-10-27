---
name: codebase-gardening
description: "Keep a codebase safe to copy: one paved path per problem, a ratcheted lint rule against every weed, existing debt removed. Use when you find tech debt or a second way to do something, when adding a lint rule or baseline, or when asked to garden a codebase."
---

# Codebase gardening

Agents copy whatever the surrounding code does, so every bad instance is a template for the next one. Gardening keeps the codebase in a state you would be happy for an agent to copy.

The skill uses four terms:

- A **weed** is a pattern you would not want copied: tech debt, an anti-pattern, or a second way to solve a problem that already has a paved path.
- A **paved path** is the one blessed way to solve a recurring problem, such as HTTP calls, error handling, or forms.
- A **ratchet** is a lint rule that fails on new occurrences while a committed baseline holds the existing ones. The baseline count only goes down.
- An **exemplar** is the one file that shows a paved path best. It is the file you point agents at.

## Garden files

Each repo keeps its own garden, because exemplars are files in that repo:

- `docs/gardening/paved-paths.md`, in the format of [paved-paths.md](references/paved-paths.md).
- `docs/gardening/anti-patterns.md`, in the format of [anti-patterns.md](references/anti-patterns.md).
- The ratchet baseline, which the linter owns. See [lint-rule-playbook.md](references/lint-rule-playbook.md).

The repo's `AGENTS.md` holds one line that points at `docs/gardening/paved-paths.md`, so every agent follows the paved paths, not only the gardener. If `docs/gardening/` is missing, create it first with [Create the registry](references/paved-paths.md#create-the-registry).

## Weeds found during other work

If you spot a weed while doing another task, keep your own change on the paved path and finish the task. Then report the weed with `file:line`, its severity, and the rule you would write. Garden it only when the user asks.

## Steps

The scope is what the user named: a diff, a path, a single weed, or the whole repo.

1. **Scan.** Run every detector in the repo's `anti-patterns.md` over the scope. For each problem in `paved-paths.md`, search the scope for code that solves it another way. Then read for weeds that no detector covers yet. Done when every detector has run, every registry problem has been searched, and every hit is recorded as `file:line` with a weed id or `new`.

2. **Classify.** Give each hit exactly one class:
   - **Weed**: a catalogue entry, or a new pattern with a replacement on the paved path. Continue to step 3.
   - **Fork**: two or more live approaches to one problem, with no paved path in the registry. Stop on this hit. Propose a winner with usage counts and a candidate exemplar, and let the human pick. Pick criteria are in [paved-paths.md](references/paved-paths.md#pick-the-winner).
   - **One-off**: a single instance that nobody is likely to copy. Fix it in place without a rule.
   - **Exception**: correct here for a reason you can state. Leave it with an inline disable comment that gives the reason.

   A weed earns a rule only when all three hold: a detector finds it with few false positives, it can spread (two or more instances, or it sits in code that others copy, such as shared utilities, templates, and examples), and its replacement is a paved path. A weed that fails the test gets a catalogue entry marked `unenforced` and is removed by hand. Done when every hit has one class, and every weed has a severity and a replacement.

3. **Stop the bleeding.** For each weed without an enforcing rule, write the rule and baseline the existing occurrences with [lint-rule-playbook.md](references/lint-rule-playbook.md). Add the weed to the catalogue and link the rule from its paved path. Done when the rule goes red on a newly added occurrence, the current tree passes, and the rule message names the paved path and its exemplar.

4. **Remove existing instances.** Move each occurrence to the paved path without changing behaviour, and prune the baseline in the same commit. Delete dead code outright. Done when the weed's baseline count is zero, or every remaining occurrence is listed with the reason it stays, such as no test coverage or a needed behaviour change.

5. **Leave an exemplar.** Pick the best instance of the paved path and fix whatever stops it from being copied as a whole file. Link it from the registry entry and from the rule message. Done when the exemplar passes every rule and you would accept an agent copying it into a new feature unchanged.

## Ship

Ship one weed per PR: the rule, its baseline, and the removals. If the removals make a large diff, stack the PRs: rule and baseline first, removals after. The PR body names the weed and its severity, the count before and after, the exemplar, and every occurrence left behind with its reason.
