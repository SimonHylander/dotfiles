#!/bin/sh
# /exe.dev/setup stub. Setup scripts are size-limited and the exe.dev docs say
# to use indirection, so this only fetches the real bootstrap.
set -eu
curl -fsSL https://raw.githubusercontent.com/SimonHylander/dotfiles/main/scripts/bootstrap.sh | bash
