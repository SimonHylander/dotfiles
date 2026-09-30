#!/usr/bin/env bash
set -euo pipefail

# Symlinks this repo's agent guidance files into each harness's global location:
#   ~/.claude/CLAUDE.md  -> <repo>/CLAUDE.md   (Claude Code)
#   ~/.codex/AGENTS.md   -> <repo>/AGENTS.md   (Codex)
#   ~/.agents/AGENTS.md  -> <repo>/AGENTS.md   (Agent Skills-compatible harnesses)
#
# Links point at the checkout, so edits take effect immediately. Safe to re-run.
# A pre-existing real file is moved aside to <file>.bak.<timestamp>, never deleted.
# Same targets as home/agents.nix, for machines not running home-manager.

REPO="${DOTFILES_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"

LINKS=(
  "CLAUDE.md:$HOME/.claude/CLAUDE.md"
  "AGENTS.md:$HOME/.codex/AGENTS.md"
  "AGENTS.md:$HOME/.agents/AGENTS.md"
)

for entry in "${LINKS[@]}"; do
  src="$REPO/${entry%%:*}"
  dest="${entry#*:}"

  if [ ! -f "$src" ]; then
    echo "error: missing $src" >&2
    exit 1
  fi

  if [ -L "$dest" ] && [ "$(readlink "$dest")" = "$src" ]; then
    echo "ok     $dest"
    continue
  fi

  if [ -e "$dest" ] && [ ! -L "$dest" ]; then
    backup="$dest.bak.$(date +%Y%m%d%H%M%S)"
    mv "$dest" "$backup"
    echo "backup $dest -> $backup"
  fi

  mkdir -p "$(dirname "$dest")"
  ln -sfn "$src" "$dest"
  echo "linked $dest -> $src"
done
