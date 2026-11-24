# Ledger

Simon's engineering preferences, one entry per preference. Each entry states the target and the check that proves a change meets it.

## Trust hierarchy

Codebase > Static analysis > Verification > Prose > Human review.

A rule held higher up is enforced on every change. A rule held in prose or review depends on someone remembering it. Push every rule as high as it can go: that move is a _climb_.

## Entries

### L1 Paved paths

Each problem the change solves uses the codebase's paved path for that problem.

- **Check:** for every new pattern, find the prior art. A second way to solve a problem that already has a paved path is a _weed_.
- **Depth:** [codebase-gardening](../codebase-gardening/SKILL.md).

### L2 Anti-patterns

The change follows every anti-pattern the codebase lists in lint config, `AGENTS.md`, or docs.

- **Check:** read the listed anti-patterns before reading the diff, then match each against the diff.

### L3 Test signal

Every test has signal: a plausible regression turns it _red_, and neither the type checker nor another test catches that regression.

- **Check:** for each added or changed test, name the regression that turns it red. A test with no nameable regression is a finding.
- **Depth:** [prune-tests rubric](../prune-tests/rubric.md).

### L4 Code over prose

Names, types, and structure carry the meaning. Comments explain only what code cannot express.

- **Check:** for each added comment or doc line, try a rename, a type, or an extraction that says the same thing. If one works, the refactor is the finding.

### L5 Types hold invariants

Illegal states are unrepresentable. External data is parsed at the boundary. Types are inferred from one source.

- **Check:** look for `any`, casts, optional fields that encode a state machine, and hand-written types that copy a schema.
- **Depth:** [type-system-discipline](../principle-type-system-discipline/SKILL.md).

### L6 Sharp boundaries

Domain logic sits in a core with no IO or framework imports. Adapters sit at the edge. Dependencies point inward. Names match the domain language.

- **Check:** trace each new import. A domain module that imports infrastructure is a finding.
- **Depth:** [boundary-discipline](../principle-boundary-discipline/SKILL.md), [model-the-domain](../principle-model-the-domain/SKILL.md).

### L7 Smallest change

The change is the smallest one that solves the stated problem. It carries no abstraction for a requirement that does not exist yet.

- **Check:** for each new abstraction, name the second caller that uses it today.
- **Depth:** [subtract-before-you-add](../principle-subtract-before-you-add/SKILL.md).
