# Engineering principles

Design codebases where the right thing is the easy thing for every human and agent.

## Trust the codebase over human review

Rank sources of truth from highest trust to lowest:

1. **Codebase.** The code and types define what the system does.
2. **Static analysis.** Type checkers, compilers, and linters enforce rules on every change.
3. **Verification.** Tests and formal checks prove that invariants hold.
4. **Prose.** Comments and documentation drift when the code changes.
5. **Human review.** Reserve human review for design and judgment that tools cannot check.

## Encode standards into the environment

Build the codebase so every human and agent writes correct code by default:

- Combine strong types, strict invariants, formal verification, and custom lint playbooks to catch mistakes before review.
- Define clear paved paths for common work and list explicit anti-patterns to avoid.
- Use Domain-Driven Design and Hexagonal Architecture alongside these rules to keep boundaries sharp, modularity high, and coupling low.

## Review systems and code

Apply these checks on every code or system review:

- **Paved paths and anti-patterns.** Check whether the change follows the codebase's paved paths or breaks them with an anti-pattern.
- **Test signal.** Keep only high-signal tests. A test has high signal when a plausible regression fails it and neither the type checker nor another test catches that regression. Remove low-signal tests.
- **Comments and documentation.** Delete any comment or document that a refactor of the code or types can express instead.
- **Automated enforcement.** Move any repeated review finding up the trust hierarchy into types, lint playbooks, or verification.
