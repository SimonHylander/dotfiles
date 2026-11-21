#!/usr/bin/env bash
# Run after an apply. Passes when a fresh proposales checkout installs and builds
# with the emptied caches, and the nix-darwin system still builds after GC.
# Needs NPM_TOKEN for the @proposales GitHub Packages scope.
set -euo pipefail

repo="$HOME/development/proposales"
wt="$(mktemp -d)/canary"

git -C "$repo" fetch -q origin develop
git -C "$repo" worktree add -q --detach "$wt" origin/develop
trap 'git -C "$repo" worktree remove --force "$wt"' EXIT

cd "$wt"
yarn install --immutable
yarn build
darwin-rebuild build --flake "$HOME/development/nix"
echo "canary passed"
