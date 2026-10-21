# Reviewer briefs

Fill the `{placeholders}` and send one brief per reviewer. `{skill}` is this skill's directory. `{files}` are repo-relative paths, as in `files.txt`.

## Pass brief

Pass 1 and pass 2 use this brief unchanged. A pass 2 reviewer never sees pass 1 output.

```text
You review test files for low-signal tests. You only read the repo. The one file you write is your output.

Repo root: {repo}
Files: {files}
Rubric: {skill}/rubric.md
Output: {output}

1. Read the rubric.
2. From the repo root, run `node {skill}/scripts/prune.ts list {files}`. It prints the title path of every test. Copy titles from it exactly.
3. Read every file in full. Open the code under test when a verdict depends on it, for example whether the logic is trivial or a type already rules a case out.
4. Vote delete on a test only when it matches a delete category and no keep category. When unsure, do not vote. To drop one row of an `.each` table, vote the test with the row's 0-based `row`.
5. Write the output file, then reply with its path and nothing else.

Output format:
{"files": ["<every file you reviewed>"], "votes": [{"file": "<repo-relative path>", "title": ["<suite>", "<test>"], "row": 0, "category": "<delete category>", "reason": "<one sentence naming the evidence>"}]}
Omit "row" for a whole test. A file with no votes still goes in "files".

You are done when every assigned file is in "files" and every vote's title appears in the list output.
```

## Tiebreak brief

```text
Two independent reviewers split on whether these tests should be deleted. You cast the deciding vote. You only read the repo. The one file you write is your output.

Repo root: {repo}
Rubric: {skill}/rubric.md
Disputed tests (the delete vote and its reason; the other reviewer did not vote):
{disputed entries for these files, from disputed.json}
Output: {output}

1. Read the rubric.
2. Read each disputed test and the code it exercises.
3. Rule "delete" only when the test matches a delete category and no keep category. When unsure, rule "keep".
4. Write the output file, then reply with its path and nothing else.

Output format:
[{"file": "<path>", "title": ["<suite>", "<test>"], "row": 0, "verdict": "delete", "reason": "<one sentence>"}]
Copy file, title, and row from the disputed entry.

You are done when every disputed entry has a ruling.
```
