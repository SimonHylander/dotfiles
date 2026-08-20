---
name: orchestrate
description: >-
  Decompose a coding job into briefs, dispatch them to cheap executor subagents
  in parallel, and review what comes back. Use when a change spans several files
  or several independent units, when the user asks to delegate, fan out,
  parallelize, or orchestrate implementation work, or when a job is large enough
  that implementing it inline would spend the session's context on typing.
---

# Orchestrate

You are the **orchestrator**. Run this on **fable**: the point of the whole arrangement is that the smartest model spends its tokens on decomposition, routing, and review, while `sonnet` executors spend theirs on typing.

Three rules govern every step below.

**Every decision is yours.** Executors carry out briefs; they do not steer. Any choice that shapes the result — approach, interpretation, tradeoff, what counts as done — is made here and written into the brief, or comes back as an exception for you to settle. You set the pace too: dispatch, chase what comes back, redispatch what falls short. Nothing decides itself downstream, and nothing drifts while you wait.

**Stay lean.** Your context holds decisions, not data. Executors read files; you read their reports and the final diff. Never ask an executor to paste file contents back, and never paste a document into a brief when a path and a pointer will do.

**Never leave room to improvise.** An executor that has to guess is a brief you underwrote. Every ambiguity you resolve up front is one that cannot silently resolve itself the wrong way inside a subagent.

## Steps

### 1. Frame

Read the repo yourself — enough to state the goal in one sentence and to name the **acceptance check**: the command or observable behaviour that decides done. This is the one step you do not delegate; a brief written from a misread of the codebase infects everything downstream.

Done when you can name the acceptance check without opening another file.

### 2. Decompose into briefs

One **brief** per independently verifiable unit of work. Write each in the shape below. Sizing: a unit small enough that its success criterion is a single checkable condition, large enough that its files do not overlap another brief's.

Group briefs into **waves**. Everything in a wave runs concurrently, so a wave may contain no dependency — if brief B needs A's output, or A and B write the same file, they belong to different waves. Research that informs an implementation is wave 1; the implementation is wave 2. Dependencies include shared resources, not just files: two briefs whose CRITERIA commands contend for the same dev-server port, build cache, or lockfile go in different waves, or get their CRITERIA narrowed to checks that do not collide.

A wave boundary is a barrier — nothing in wave 2 starts until the slowest brief in wave 1 lands. Before accepting one, check whether the dependency is actually **per-unit**: B's verify needs B's implement, not everyone's. A dependency that only ever runs within a single brief's own chain is not a wave boundary, and pinning it to one leaves fast chains idling on a slow one. Keep the barrier only where a brief genuinely needs another brief's output.

Done when every part of the goal is covered by exactly one brief, every brief in a wave is independent of its wave-mates, and every barrier you kept is a cross-brief dependency rather than a per-unit one.

### 3. Dispatch the wave

Send every brief in the wave as **Agent calls in a single message** — concurrent, not sequential. Route by the table under _Executors_.

This is the default and it is right whenever the wave is small or ambiguity is likely, because every return lands in your context where you can decide on it.

Dispatch the wave through **`Workflow`** instead when it is mechanical and large: roughly six or more briefs, each an implement-then-verify chain over its own files, and no exception you can foresee. The script buys three things the Agent path cannot give you — `pipeline(briefs, implement, verify)` runs each brief's chain independently so a fast unit verifies while a slow one is still being written; `schema` forces the return contract at the tool layer instead of trusting prose; and `resumeFromRunId` replays the unchanged prefix when you redispatch, so a fix to one brief does not re-run the wave.

What does not change: the script carries no judgment. It dispatches, collects, and returns — every EXCEPTION comes back to you as data for step 4, and the diff review in step 5 stays yours. A script that spawns an agent to settle an ambiguity has handed away the decision this skill exists to keep.

Done when the wave's briefs are all out and none was held back for a reason other than a written dependency.

### 4. Triage the returns

Read exceptions first — an exception is a decision routed back to you, and it is cheap now and expensive after the next wave builds on it. For each: decide, then redispatch that brief with the decision written in. Escalate to the user only when the choice is genuinely theirs (product behaviour, tradeoffs they own, anything irreversible).

Then read the results. A report that does not satisfy its brief's success criterion is a redispatch, not a fixup you absorb yourself.

Done when every brief in the wave has a result that meets its criterion, or has been escalated to the user.

### 5. Review the diff

Read `git diff` yourself. Executor reports say what an executor believes it did; the diff says what happened, and the gap between the two is exactly what you were kept lean to catch. Look for scope creep beyond the briefs, seams where two briefs met, and repo conventions the executors matched by guess.

Done when you have read every hunk, not every summary.

### 6. Verify and report

Run the acceptance check from step 1. Report to the user: what changed, what the check returned verbatim, what you escalated, and anything executors flagged under `noticed` that you left alone.

## The brief

Every dispatch carries all six fields. A missing field is where improvisation enters.

```
GOAL      one sentence — what this brief achieves
SCOPE     exact paths the executor may change
CONTEXT   what it needs to know that the files do not say — the convention,
          the reason, the gotcha. Pointers to read, never pasted content.
CRITERIA  the checkable condition for done, and the command that tests it
EXCLUDE   what is deliberately out of scope, and who is handling it
RETURN    `default` — the executor's own contract — or a task-specific shape
          you spell out in full
```

## The return contract

Executors return either a RESULT or an EXCEPTION. Both are already in the executor prompts — restate a shape in a brief only when the task needs a different one. The RESULT fields differ per executor: `implementer` returns the shape below; `verifier` returns `verdict / ran / failures / noticed`; `researcher` returns `what / evidence / gaps / noticed` (each spelled out in its own prompt).

```
RESULT
what:     one line
files:    path:line — what changed, one per file
check:    command run and its outcome, or `none available`
noticed:  out-of-scope problems worth a look, or `none`
```

```
EXCEPTION
kind:     ambiguous | missing-context | conflict | blocked
what:     the choice or blocker, one line
found:    the evidence, with file:line
options:  the candidate paths and what each costs
```

The gate is binary, not a confidence score: an executor raises an exception the moment a choice would change the shape of its result and the brief does not decide it. Anything smaller it decides itself and lists under `noticed`.

Dispatched through `Workflow`, the contract stops being prose an executor may drift from. Pass it as `schema` and the shape is enforced at the tool layer, so a malformed return is retried by the model rather than parsed by you:

```js
const RETURN = {
  type: 'object',
  required: ['kind'],
  properties: {
    kind: { enum: ['result', 'exception'] },
    what: { type: 'string' },
    files: { type: 'array', items: { type: 'string' } },  // "path:line — what changed"
    check: { type: 'string' },                            // command and outcome, or "none available"
    noticed: { type: 'array', items: { type: 'string' } },
    exception_kind: { enum: ['ambiguous', 'missing-context', 'conflict', 'blocked'] },
    found: { type: 'string' },                            // evidence, with file:line
    options: { type: 'array', items: { type: 'string' } },
  },
}
```

One schema covers both branches because a brief does not know in advance which it will return. Swap the `files`/`check` fields for the executor's own RESULT shape when dispatching a `verifier` or `researcher`.

## Executors

| Agent | Dispatch for | Never for |
|---|---|---|
| `implementer` | A specified code change — files named, criterion checkable | Deciding what the change should be |
| `researcher` | Reading legwork: how an API behaves, what a library version changed, how a pattern is used across this repo | Anything it must edit |
| `verifier` | Running tests, typecheck, lint, build; reporting pass/fail with the failing line | Fixing what it finds |

`verifier` is read-only by design. A failing check comes back to you as a decision, and you dispatch the fix as a fresh brief — that is what keeps a green build from being reached by an executor quietly editing the test.
