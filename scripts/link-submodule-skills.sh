#!/usr/bin/env bash
set -euo pipefail

# Links every skill found in a git submodule's `skills/` directory into
# ~/.claude/skills (Claude Code) and ~/.agents/skills (Codex and other harnesses).
# Submodules are read from .gitmodules, and each skill is a symlink into the
# checkout, same semantics as link-skills.sh. Uninitialized submodules are skipped.

REPO="${DOTFILES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
DESTS=("$HOME/.claude/skills" "$HOME/.agents/skills")

if [ ! -f "$REPO/.gitmodules" ]; then
  echo "no .gitmodules in $REPO"
  exit 0
fi

while read -r _ sub_path; do
  skills_dir="$REPO/$sub_path/skills"
  if [ ! -d "$skills_dir" ]; then
    echo "warn: $sub_path has no skills/ directory (run: git submodule update --init) — skipping" >&2
    continue
  fi

  for skill_md in "$skills_dir"/*/SKILL.md; do
    [ -f "$skill_md" ] || continue
    src="$(dirname "$skill_md")"
    name="$(basename "$src")"

    for dest in "${DESTS[@]}"; do
      mkdir -p "$dest"
      target="$dest/$name"

      if [ -e "$target" ] && [ ! -L "$target" ]; then
        rm -rf "$target"
      fi

      ln -sfn "$src" "$target"
      echo "linked $name -> $src ($dest)"
    done
  done
done < <(git config -f "$REPO/.gitmodules" --get-regexp '^submodule\..*\.path$')
