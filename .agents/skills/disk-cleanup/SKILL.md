---
name: disk-cleanup
description: >-
  Free disk space on this Mac with retention rules for package caches, app
  caches, build output, and git worktrees. Use when disk space is low or when
  asked to clean up caches, worktrees, or disk.
---

# Disk cleanup

`scripts/disk-cleanup.ts` scans every data class, predicts how much each rule
frees, and writes the full report to
`~/Library/Logs/disk-cleanup/last-report.json`. Rules come in three tiers:

- **Tier 1** runs the owning tool's own cleanup command (`bun pm cache rm`,
  `nix-store --gc`, `pnpm store prune`). The data regenerates. It runs without
  approval, and only when container free space is under 10 GB.
- **Tier 2** deletes regenerable data older than 7 days that has no cleanup
  command: npx folders, app update downloads, app cache files, build output in
  idle worktrees. It runs only after approval.
- **Tier 3** can lose work or state: worktrees, scratch folders, app state
  files. The script only reports these. You run each approved item yourself.

macOS update files are out of scope.

## Steps

1. Run `bun scripts/disk-cleanup.ts --apply` from this skill's directory. It
   takes about three minutes. Done when the report table prints and either
   tier 1 results or "above the floor, nothing applied" follow it.
2. If tier 1 deleted anything, run `scripts/canary.sh` in the background. It
   installs and builds a fresh `proposales` checkout and builds the nix-darwin
   system. Done when it prints "canary passed", or when you have the failing
   command and its output.
3. Present every tier 2 rule and every tier 3 item from the JSON report for
   approval. Give each one a code, its size, its `why`, and its `undo`. For
   `git-worktrees`, also give the count of blocked worktrees and their reasons.
   Done when the user has answered for each code.
4. Apply what the user approved:
   - Tier 2: `bun scripts/disk-cleanup.ts --apply --rules=<id>,<id>`.
   - Tier 3: run each approved item's `action` argv from the JSON report, in
     its `cwd` when one is set. Quit the app named in `why` first.
5. Report predicted against actual bytes freed per rule from
   `~/Library/Logs/disk-cleanup/apply.jsonl`, and the canary result.

Delete only the candidates in the JSON report. A rule's prediction marked
`(max)` comes from a tool with no dry run, so the real figure is lower.
