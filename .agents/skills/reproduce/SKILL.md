---
name: reproduce
description: Answer "What are the steps to reproduce the original issue?" from the ticket, conversation, and code. Use when the user asks for repro steps, how to reproduce a bug, or invokes /reproduce.
---

# Reproduce

Answer one question: **What are the steps to reproduce the original issue?**

The original issue is the bug or behavior that started this work: the ticket, the user's first report, or the failure under investigation. It is not a later side issue found along the way.

## 1. Find the original issue

Take it from the conversation first: the ticket, the Workup, the user's report, error text, logs. If none of these is in context, ask the user for the ticket or report and stop.

## 2. Build the steps

- Start from a clean, named starting state: environment, account or customer, feature flags, data that must exist.
- One action per step, in order, specific enough that someone new can follow it. Name the exact screen, endpoint, command, or input values.
- End with the step where the issue shows.
- Read code to fill gaps when it settles a step cheaply (the handler a button calls, the condition that triggers the branch). Do not query production or third-party systems. Name the check that would settle it instead.

Mark each step `(confirmed)` when it comes from the report, a log, or a traced code path, and `(inferred)` when it is a guess.

## 3. State expected and actual

- **Expected**: what should happen at the last step.
- **Actual**: what happens instead. Quote the exact error or wrong value when known.

## Output

End with this block, since the user reads the last thing first:

```
Original issue: <one sentence>

Preconditions
- <environment, data, flags, account>

Steps
1. <action> (confirmed|inferred)
2. <action> (confirmed|inferred)
3. <action where issue shows> (confirmed|inferred)

Expected: <behavior>
Actual: <behavior, exact error if known>

Gaps: <what is unknown and how to settle it, or "none">
```
