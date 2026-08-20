---
name: plan
description: >-
  Turn research or findings in this conversation into an implementation
  plan, verifying every assumption they rest on first. Use when the user asks to
  plan the work, turn findings into a plan, or decide next steps after an
  investigation or diagnosis.
---

# Plan

Turn what this conversation has established into a plan the work can stand on. The findings already in context are the input: they arrived through reading, inference, and summary, and any of them may be wrong by now or wrong from the start.

Two rules govern every step.

**Testimony, not evidence.** What the conversation says about the code, the system, or the constraints is testimony. Evidence lives in the environment — files, command output, docs. Every claim the plan rests on gets re-checked against evidence, however confidently the conversation stated it.

**Ask, never guess.** The moment something is unclear — a claim that cannot be verified, a tradeoff that is the user's to make, a gap in the request itself — stop and ask. A question asked now is cheap; the same question baked into the plan as a guess is a defect every later step inherits.

## Steps

### 1. Harvest the claims

Sweep the conversation and write down every **load-bearing claim** — a statement the plan would change if it were false. Findings from research, conclusions from a diagnosis, constraints the user stated, and quiet defaults nobody examined ("we're on v4", "only one caller", "tests cover this") all count; note beside each where it came from.

Done when the plan could be built from the claim list alone, without rereading the conversation.

### 2. Verify each claim

Check every claim against evidence: read the file, run the command, open the doc. Verdicts:

- **Confirmed** — evidence found; cite it (`path:line`, command output).
- **Refuted** — evidence contradicts it; write the correction.
- **Open** — no evidence reachable, or the answer is a judgement only the user can make.

Done when every claim carries a verdict and no verdict says "probably".

### 3. Settle the open claims

Put every open claim to the user as a direct question — one round, all questions at once, each with its options and your recommendation. Wait for the answers.

Done when no open claims remain: everything is confirmed, refuted-and-corrected, or answered by the user.

### 4. Write the plan

Build the plan on confirmed claims and user answers only. Numbered steps, each ending on a checkable done-condition; name the files each step touches and the command or observation that proves the whole thing works. Where a refuted claim changed the shape of the plan, say so — one line each — so the user sees where the conversation had it wrong.

Done when every step has a done-condition and every claim the plan relies on appears in the verified list.
