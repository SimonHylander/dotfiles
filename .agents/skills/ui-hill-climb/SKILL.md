---
name: ui-hill-climb
description: Hill-climb a UI surface (a screen or flow) against reference products, round by round, with blind model judges scoring screenshots and fixes limited to what they flag. Pass the surface and its route.
disable-model-invocation: true
---

# UI hill climb

One surface climbs until it beats every reference in every category for every judge, round after round of capture, gates, blind judging and fixes. The brief is `PRODUCT.md` and `DESIGN.md`. DESIGN.md wins over any judge or impeccable rule, so a finding that asks for something DESIGN.md decides is skipped, not fixed.

Defaults, unless the user sets them:

- **Target**: ours scores above every reference in every category, and at least 9 in each, for every judge.
- **Judges**: GPT Sol (`gpt-6.1-sol`, Codex, reasoning effort high) alone until ours passes; then Opus (`claude-opus-5-5`) joins and both must pass.
- **Stop**: three rounds in a row without a new best total for a judge (`score.mjs` counts them).
- **Shots**: every state at desktop 1280×800 and phone 390×844, light and dark.

Keep the climb's working files in a **work dir** outside the repo (the session scratchpad): judge packets, mappings, scores, the ledger, `council.json`. Screenshots and references go in the main checkout's `.scratch/` (`design-review/<surface>/round-N/`, `design-references/<surface>/`). Stage paths by name, never `git add -A`.

## Setup

1. **Worktree.** A worktree off the default branch on `design/<surface>-climb`, with dependencies installed. Done when the worktree is on the branch and installed.
2. **Impeccable.** Use an installed impeccable skill (`SKILL.md`, `reference/`, `scripts/impeccable`), and ask the user for its path when none is found. Never run `npx impeccable`: it fetches the latest version. Set `IMPECCABLE_NO_TELEMETRY=1`. Done when `scripts/impeccable --help` prints.
3. **Surface config.** `<work>/surface.json`, the input to `capture.mjs` and `packet.mjs`:
   - `surface`: the name used in `.scratch` paths and the branch.
   - `url`, `ready`: the harness URL, and the heading that shows the page has loaded.
   - `states`: `[{ "name", "path"?, "open"? }]`, the states a user meets on this surface (the usual one, empty, a form, an error it shows). Each loads `url` plus its `path`, a query or sub-path the harness reads. One with `open` clicks the button of that name and captures the dialog.
   - `views`: `{ "<state>": "<view>" }`, each state's name as judges see it.
   - `stubs`: `{ "<URL substring>": <JSON body> }`, the responses the page needs. A request whose URL contains a key gets that body. Other requests go to the network.
   - `references`: `{ "<product>": { "<viewport>-<view>-<theme>": "<file>" } }`, files in `.scratch/design-references/<surface>/`.
   - `rubricIntro`: one paragraph on what the screen is for, who uses it, and on which device.
   - `categories` (optional): `{ "<key>": "<what judges score>" }`, rubric categories this surface needs beyond the core ones in `scripts/packet.mjs`, such as an assistant where the surface shows one.

   Done when every field describes this surface and its users.
4. **References.** `.scratch/design-references/<surface>/`. When it is missing, ask the user whether to collect them, wait for theirs, or judge without. To collect, dispatch a Sonnet subagent to save official screenshots (marketing pages, help centres, app store listings; no sign-ups) of 2–3 comparable products, desktop normalised to 1280×800 and phone to 390×844, with `SOURCES.md` listing each file's URL; ImageMagick is `nix shell nixpkgs#imagemagick`. Look at every file yourself. Done when at least two products are in the config's `references`.
5. **Harness.** Add a route that renders this surface signed out from fixed sample data, so every round renders the same screen, and reads each state's `path`. Copy every existing file the harness changes (a root layout, a generated route tree) so Finish can restore it. Start the dev server with `run_in_background` and `timeout: 7200000`, or it dies mid-climb. Install `playwright@1.55.0` and `axe-core@4.10.3` in `<work>/pw` and copy `scripts/capture.mjs` there. Done when a capture runs and you have looked at every screenshot and found no harness artifact: an error the harness causes, a loading skeleton, AM/PM times, sample data that contradicts itself. A round judged on artifacts is discarded and judged again.

## Each round

1. **Capture.** `node capture.mjs <work>/surface.json <scratch>/design-review/<surface>/round-N`. Done when every state has its four shots: desktop and phone, light and dark.
2. **Gates.** All pass before judging:
   - `capture.mjs` reports 0 axe nodes (contrast included) and 0 surface targets under 44 px. The 44 px gate covers controls inside `main` or a dialog. Controls outside are reported apart.
   - `scripts/impeccable detect <changed files>` finds no more issues than the round before.

   A failing gate is fixed now, with impeccable's `adapt`, and captured again.
3. **Judge.** `node scripts/packet.mjs <work>/surface.json N <work>` builds a fresh blind packet, letters shuffled. Start each judge as a new delegate (`delegate_task`, async) with the prompt below, never a message to an earlier judge. Done when each judge has written its scores file.
4. **Score.** `node scripts/score.mjs N <judge> <work>` per judge. It prints each product's mean per category, what blocks the target, and the flat streak. Show the user the table.
5. **Triage.** For each weakness named on ours, decide one: fix, skip (DESIGN.md decides it; cite the section), skip (harness artifact), or skip (reverses a fix the ledger records). Append each decision to `<work>/ledger.md`, one line with the round, and read the ledger before deciding: judges swing between opposites (one row of chips, then two), and the ledger keeps a fix from being undone. Done when every weakness on ours has a ledger line.
6. **Fix.** Before each fix, load impeccable's command for its category: hierarchy or spacing `layout`, typography `typeset`, color `colorize` or `quieter`, copy and state `clarify`, phone and targets `adapt`. Read `reference/craft-floor.md` before the first edit. `bolder`, `delight`, `overdrive` and `live` stay unused. A shared component (the design system, the app shell) changes only when the finding is on this surface; list each one for the PR.
7. **Verify.** Type-check the app and run the tests of every package touched; a changed behaviour changes its test in the same commit. Capture again and compare each shot with the last round's: a fix that hurts another category (a fade that washed out a hint) is reverted now. Done when the gates pass on the new shots.
8. **Commit.** Stage the changed paths by name: never the harness files or `.scratch`. Message `Round N: <what changed>`, a line per fix, no co-author.

The judge's prompt, with the round's paths filled in:

```text
You are a blind design judge.

Use ONLY the files in this directory:
<work>/judge/round-N/packet

Do not open any other file or directory (not the repository you start in, not parent directories). Everything you need is in the packet.

1. Read RUBRIC.md, then DESIGN.md.
2. Look at every PNG under each product folder (view each image; do not guess from file names).
3. Score every image on every rubric category, 1-10, and name its top 3 weaknesses, exactly as RUBRIC.md says.

Write the JSON that RUBRIC.md specifies, covering every image, to this one file (the only file you may create):
<work>/judge/round-N/scores-<judge>.json
Then reply with the same JSON.
```

## Finish

- **A level passes**: open a PR (the `file-pr` skill) with the council table from `council.json` (rounds × judges, ours' total and per-category means), annotated before/after screenshots that point to each change (round-1 and final shots side by side, a numbered marker per change), and the shared components touched. Then stop and wait: each higher target the user sets is a new PR stacked on this one.
- **The climb stops flat**: push the branch, open no PR, and report the blocking categories, each with the findings behind it and why they stayed (DESIGN.md, a shared file, a harness artifact).
- **Either way**: delete the harness route, restore the files it changed from their copies, and stop the server. Done when `git status` in the worktree is clean.
