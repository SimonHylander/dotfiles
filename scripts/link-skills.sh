#!/usr/bin/env bash
set -euo pipefail

# Links every skill in this repo into the skill directories used by each agent
# harness:
#   ~/.claude/skills  — Claude Code
#   ~/.agents/skills  — Codex and other Agent Skills-compatible harnesses
#
# Each entry is a symlink into the checkout, so editing a SKILL.md takes effect
# immediately and `git pull` is enough to update.
#
# This deliberately mirrors the semantics of mattpocock/skills' script of the
# same name — both write into the same two directories, and matching behaviour
# is what lets them coexist predictably. That repo's copy is marked dev-only and
# closed to modification, hence a separate copy here rather than reusing theirs.

REPO="${DOTFILES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
SRC_ROOT="$REPO/.agents/skills"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

if [ ! -d "$SRC_ROOT" ]; then
  echo "error: no skills directory at $SRC_ROOT" >&2
  exit 1
fi

# Collect the repo's skills once, link into every destination.
names=()
srcs=()
while IFS= read -r -d '' skill_md; do
  src="$(dirname "$skill_md")"
  names+=("$(basename "$src")")
  srcs+=("$src")
done < <(find "$SRC_ROOT" -name SKILL.md -not -path '*/node_modules/*' -print0)

if [ ${#names[@]} -eq 0 ]; then
  echo "no skills found in $SRC_ROOT"
  exit 0
fi

for DEST in "${DESTS[@]}"; do
  # If $DEST is a symlink resolving into this repo, the per-skill symlinks would
  # be written back into the repo's own tree. Bail rather than pollute it.
  if [ -L "$DEST" ]; then
    resolved="$(readlink -f "$DEST")"
    case "$resolved" in
      "$REPO" | "$REPO"/*)
        echo "error: $DEST is a symlink into this repo ($resolved)." >&2
        echo "Remove it (rm \"$DEST\") and re-run; it will be recreated as a real dir." >&2
        exit 1
        ;;
    esac
  fi

  mkdir -p "$DEST"

  for i in "${!names[@]}"; do
    name="${names[$i]}"
    src="${srcs[$i]}"
    target="$DEST/$name"

    if [ -e "$target" ] && [ ! -L "$target" ]; then
      rm -rf "$target"
    fi

    ln -sfn "$src" "$target"
    echo "linked $name -> $src ($DEST)"
  done
done
