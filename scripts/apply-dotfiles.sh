#!/usr/bin/env bash
set -euo pipefail

repo_root=${DOTFILES_ROOT:-$PWD}

if [[ ! -f "$repo_root/flake.nix" || ! -d "$repo_root/.agents/skills" ]]; then
  printf 'error: run this from the dotfiles repository, or set DOTFILES_ROOT\n' >&2
  exit 1
fi

link() {
  local source=$1
  local target=$2

  mkdir -p "$(dirname "$target")"

  if [[ -L "$target" && "$(readlink "$target")" == "$source" ]]; then
    printf 'unchanged  %s -> %s\n' "$target" "$source"
    return
  fi

  if [[ -e "$target" || -L "$target" ]]; then
    printf 'error: %s already exists and is not the expected symlink\n' "$target" >&2
    exit 1
  fi

  ln -s "$source" "$target"
  printf 'linked     %s -> %s\n' "$target" "$source"
}

link "$repo_root/.agents/skills" "$HOME/.claude/skills"
