# Anti-patterns

The catalogue lists every known weed: how to detect it, its severity, and its replacement. Each repo keeps its catalogue at `docs/gardening/anti-patterns.md`. Copy the seed weeds below into a new catalogue only when the repo has them.

## Severity

Severity sets the order of work. Garden S1 first.

- **S1, harmful**: causes bugs or security holes. Examples are swallowed errors, `any` at a boundary, and unvalidated input.
- **S2, spreading**: a second way to solve a problem that has a paved path. Every copy makes the migration larger.
- **S3, clutter**: dead code, commented-out code, and unused exports. Delete it.

## Entry format

```md
### W9 Raw `fetch` outside the API client

- **Severity:** S2
- **Detect:** `rg -n '\bfetch\(' src --glob '!src/lib/api.ts'`
- **Rule:** `no-restricted-globals` on `fetch`, baselined
- **Replace with:** paved path "HTTP calls"
```

- **Detect** is a command that lists every occurrence. Use `rg` for text patterns and `ast-grep` for structure that text search misreads.
- **Rule** is the enforcing lint rule, or `unenforced` when the weed fails the rule test in the skill's Classify step.
- **Replace with** names a paved path, or `delete`.

Weed ids are stable. A retired weed keeps its id, so old PRs and rule messages still resolve.

## Seed weeds

### W1 `any`

- **Severity:** S1
- **Detect:** `rg -n ':\s*any\b|<any>|as any\b' --type ts`
- **Rule:** `@typescript-eslint/no-explicit-any`
- **Replace with:** inferred types. At a boundary, take `unknown` and parse it with the paved path for validation.

### W2 Type assertions with `as`

- **Severity:** S1
- **Detect:** `ast-grep -p '$X as $T' -l ts`
- **Rule:** `@typescript-eslint/consistent-type-assertions` with `assertionStyle: "never"`. The rule always allows `as const`.
- **Replace with:** a schema parse, a type guard, or `satisfies`.

### W3 `@ts-ignore` and bare `@ts-expect-error`

- **Severity:** S1
- **Detect:** `rg -n '@ts-(ignore|expect-error)' --type ts`
- **Rule:** `@typescript-eslint/ban-ts-comment`, which allows `@ts-expect-error` only with a description
- **Replace with:** fix the type. If the error is in a third-party type, use `@ts-expect-error` with the reason.

### W4 Swallowed errors

- **Severity:** S1
- **Detect:** `ast-grep -p 'try { $$$ } catch ($E) { }' -l ts`. Also read catch blocks that only log.
- **Rule:** `no-empty` for empty blocks. A catch that only logs is `unenforced`.
- **Replace with:** paved path "Error handling"

### W5 Direct `process.env` reads

- **Severity:** S2
- **Detect:** `rg -n 'process\.env' --type ts`, excluding the config module
- **Rule:** `no-restricted-syntax` with the selector `MemberExpression[object.name='process'][property.name='env']`, turned off for the config module
- **Replace with:** paved path "Configuration and environment variables"

### W6 Two libraries for one job

- **Severity:** S2
- **Detect:** read `package.json` for overlapping dependencies, such as two date libraries or two HTTP clients
- **Rule:** `no-restricted-imports` on the losing package
- **Replace with:** the paved path for that problem, then remove the losing package

### W7 Dead code

- **Severity:** S3
- **Detect:** `npx knip` for unused files, exports, and dependencies
- **Rule:** `knip` in CI
- **Replace with:** delete

### W8 Commented-out code

- **Severity:** S3
- **Detect:** `rg -n '^\s*//\s*(const|let|if|return|import|await)\b'`
- **Rule:** `unenforced`
- **Replace with:** delete. Git keeps the history.
