---
name: sol-loop
description: Review this thread's change with gpt-6.1-sol in rounds until both models converge, then file the PR.
disable-model-invocation: true
---

# Sol loop

Get a second opinion on the change from a different model family. You are the **author**. Sol is the **reviewer**. Trade rounds until the review **converges**, then file the PR.

Input: optional base ref and a one-line intent. Default base is the repo's default branch. Derive the intent from the conversation when it is not given.

## 1. Prepare

1. If HEAD is on the default branch, create a branch for the change.
2. Commit all of the change, so Sol reviews exactly HEAD. Record the SHA.
3. Pick the transport:
   - **T3**: the `delegate_task` tool is available. Run `orchestrator_capabilities` with search `sol` and confirm `gpt-6.1-sol` under the `codex` provider.
   - **Codex CLI**: otherwise, when `codex` is on PATH.
   - Neither: stop and say so.

## 2. Run a round

Build the round prompt from the template below and send it.

**T3**: start a new `delegate_task` every round.

```json
{
  "task": "<round prompt>",
  "title": "sol-loop round <n>",
  "role": "review",
  "mode": "wait",
  "timeoutMs": 1800000,
  "clientRequestId": "sol-loop-<branch>-<sha>-r<n>",
  "target": { "providerInstanceId": "codex", "model": "gpt-6.1-sol", "options": { "reasoningEffort": "xhigh" } }
}
```

On `waitTimedOut`, poll `task_status` with the returned `taskId` until the result is available.

**Codex CLI**:

```bash
mkdir -p /tmp/sol-loop
codex exec -m gpt-6.1-sol -c model_reasoning_effort=xhigh -s read-only -C "$(git rev-parse --show-toplevel)" \
  -o /tmp/sol-loop/<branch>-r<n>.md - < /tmp/sol-loop/<branch>-r<n>-prompt.md
```

### Round prompt

Every round carries the full context, because Sol starts fresh each time.

```text
You are reviewing a code change in <repo path>. Another model wrote it. Read-only: do not edit files.

Intent: <one line>
Base: <base ref>. Head: <sha>. See the change with `git diff <base>...<sha>`.
Round <n>.

Find defects that would make the change wrong: bugs, broken callers, missed cases, security holes, and mismatches with the intent. Read beyond the diff to check callers and contracts. Run read-only commands when they settle a question.

<rounds 2+: the ledger below, verbatim>
For each accepted entry, check the fix at its SHA. For each rejected entry, reply `withdrawn` or `stands`. A `stands` must add evidence the author has not answered yet.

Reply with findings only, one block each:
F<id> [blocker|major|minor] <file:line>
Claim: <one sentence>
Failure: <concrete input or state, and the wrong result>
Evidence: <code read or command run>

Reply `NO FINDINGS` when you have none.
```

## 3. Judge each finding

You own the code, so you decide. Judge every finding on evidence:

- **accept**: fix it, run the affected checks, commit. Record the SHA.
- **reject**: reply with evidence that refutes the claim, such as a `file:line`, a command and its output, or a test.

Keep a **ledger** with one entry per finding: id, severity, claim, verdict, and the SHA or evidence. Give new findings fresh ids across rounds.

## 4. Converge

The review has converged when the latest round meets one of these:

- Sol replies `NO FINDINGS`, or only minor findings that you judged.
- Every finding still standing is a repeat. Sol has seen your rebuttal and added no new evidence, and your evidence still holds. Close it as **rejected with evidence**.

Until then, run the next round. After round 5, stop the loop. File the PR with the open findings listed in it, and name them in your report.

## 5. File the PR

Push the branch. Open the PR with the `pr` skill, or update the body if a PR exists for the branch. Add a `Second opinion` section to the body: the round count, the accepted findings with their SHAs, and each rejected finding with its one-line rebuttal. In T3, register the PR with `link_pull_request`.

## Report

The ledger as a table, then the PR URL last.
