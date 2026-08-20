#!/usr/bin/env bash
set -euo pipefail

# Brings every skill source into ~/.claude/skills and ~/.agents/skills.
# Run by home-manager activation, and safe to run by hand at any time.
#
# Ordering is deliberate: mattpocock's linker uses `ln -sfn` and `rm -rf`, so
# whichever runs last wins a name collision. Ours runs last, so a future
# duplicate name resolves in favour of the repo we control. (There is no
# collision today.)

REPO="${DOTFILES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SKILLS_REPO="${SKILLS_REPO:-$HOME/development/mattpocock-skills}"
SKILLS_REMOTE="https://github.com/mattpocock/skills"

# 1. mattpocock/skills — clone or update, then run its own linker.
#    A network hiccup must not fail the activation, so every step warns instead.
if [ ! -d "$SKILLS_REPO/.git" ]; then
  echo "cloning $SKILLS_REMOTE -> $SKILLS_REPO"
  git clone --depth 1 "$SKILLS_REMOTE" "$SKILLS_REPO" ||
    echo "warn: could not clone $SKILLS_REMOTE" >&2
else
  git -C "$SKILLS_REPO" pull --ff-only ||
    echo "warn: could not update $SKILLS_REPO" >&2
fi

if [ -x "$SKILLS_REPO/scripts/link-skills.sh" ]; then
  "$SKILLS_REPO/scripts/link-skills.sh" ||
    echo "warn: $SKILLS_REPO/scripts/link-skills.sh failed" >&2
else
  echo "warn: no link-skills.sh in $SKILLS_REPO — skipping" >&2
fi

# 2. This repo's own skills, last.
DOTFILES_ROOT="$REPO" "$REPO/scripts/link-skills.sh"
