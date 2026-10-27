# Lint rule playbook

How to write a rule that stops a weed from spreading, and how to ratchet it so the existing count only goes down.

## Pick the strongest mechanism

Use the first mechanism on this list that can express the weed:

1. **Make it unrepresentable.** A branded type, an exhaustive union, or a private constructor turns the weed into a type error.
2. **Turn on a rule the repo's linter already ships**, such as a `typescript-eslint` rule.
3. **Write a restriction rule.** `no-restricted-syntax`, `no-restricted-imports`, and `no-restricted-globals` take an AST selector or a name and a custom message. They cover most repo-specific weeds without plugin code.
4. **Write a custom rule** in a local ESLint plugin. Use it only when a selector cannot express the weed.
5. **Write an `ast-grep` rule** for a language without a suitable linter.
6. **Count with a script**, as in [Ratchet without ESLint](#ratchet-without-eslint).

Adding a new tool, plugin, or dependency needs the human's approval. A new rule on an installed tool does not.

## Write the message

The rule message is the guidance an agent reads at the moment it copies the weed. Name the replacement and the exemplar:

```js
{
	selector: "MemberExpression[object.name='process'][property.name='env']",
	message: "W5: read config from `env` in src/config.ts. See src/features/billing/stripe.ts.",
}
```

## Prove the rule

1. Add one occurrence of the weed to a file in scope, and run the linter. It must fail.
2. Remove the occurrence.
3. Run the rule over the whole tree, and read at least ten hits. If any hit is a false positive, tighten the rule before you baseline it. A baseline hides its false positives for good.

## Ratchet with ESLint

ESLint 9.24 and later write a baseline with bulk suppressions:

1. Set the rule to `"error"`. Suppressions skip rules set to `"warn"`.
2. Run `npx eslint . --suppress-rule <rule>`. ESLint writes every current violation to `eslint-suppressions.json`. Commit the file.
3. CI runs `eslint .` with no extra flags. A new violation fails the build. A fixed violation leaves an unused suppression, which also fails the build, so the PR that fixes it must run `npx eslint . --prune-suppressions`.

Suppressions count violations per file and per rule. A violation moved to another file fails CI, so fix it while you move it.

The baseline only goes down. To clear a new failure, fix the code. Never re-run `--suppress-rule` or `--suppress-all` on a rule that already has a baseline, and never add `--pass-on-unpruned-suppressions` to CI. Each of those raises the count without a failure.

## Ratchet without ESLint

For a detector outside ESLint, commit the expected count and fail CI on any difference. A higher count is a new weed. A lower count means the PR forgot to lower the baseline.

`docs/gardening/baseline.tsv` holds one weed per line: id, count, path, and pattern, separated by tabs.

```sh
#!/usr/bin/env bash
# Fails when a weed count differs from docs/gardening/baseline.tsv.
set -euo pipefail
status=0
while IFS=$'\t' read -r id expected path pattern; do
	actual=$({ rg -c --no-filename -e "$pattern" "$path" || true; } | awk '{ s += $1 } END { print s + 0 }')
	if [ "$actual" -ne "$expected" ]; then
		echo "$id: baseline $expected, found $actual"
		status=1
	fi
done < docs/gardening/baseline.tsv
exit "$status"
```

## Retire a rule

When a weed's count reaches zero, delete its baseline entry and keep the rule. When a paved path changes, the old path becomes a weed with a new catalogue entry and a new rule.
