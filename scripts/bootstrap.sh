#!/usr/bin/env bash
set -euo pipefail

# First-install bootstrap: Nix -> clone -> home-manager switch.
# Idempotent; safe to re-run on an already-configured machine.
#
#   curl -fsSL https://raw.githubusercontent.com/SimonHylander/dotfiles/main/scripts/bootstrap.sh | bash
#
# Environment overrides:
#   DOTFILES_ROOT   checkout location            (default ~/development/dotfiles)
#   DOTFILES_REMOTE clone source                 (default the public GitHub repo)
#   HM_CONFIG       homeConfigurations attr name (default <user>@<system>)
#   TARGET_USER     user to configure when run as root (default exedev, then SUDO_USER)

DOTFILES_REMOTE="${DOTFILES_REMOTE:-https://github.com/SimonHylander/dotfiles}"
BOOTSTRAP_URL="${BOOTSTRAP_URL:-https://raw.githubusercontent.com/SimonHylander/dotfiles/main/scripts/bootstrap.sh}"

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarn:\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31merror:\033[0m %s\n' "$*" >&2
  exit 1
}

have_nix() { command -v nix >/dev/null 2>&1; }

load_nix_profile() {
  # Multi-user (daemon) layout first, then single-user.
  for p in \
    /nix/var/nix/profiles/default/etc/profile.d/nix-daemon.sh \
    "$HOME/.nix-profile/etc/profile.d/nix.sh"; do
    if [ -e "$p" ]; then
      # shellcheck disable=SC1090
      . "$p"
      return 0
    fi
  done
  return 1
}

install_nix() {
  if have_nix || { load_nix_profile && have_nix; }; then
    log "nix already installed ($(nix --version))"
    return
  fi

  case "$(uname -s)" in
    Darwin)
      log "installing nix (determinate, macos planner)"
      curl -fsSL https://install.determinate.systems/nix |
        sh -s -- install macos --no-confirm
      ;;
    Linux)
      # Always a daemon install, even with no init system. A single-user install
      # would own ~/.nix-profile via nix-env, which is the same profile
      # home-manager wants to manage with `nix profile` — they don't mix.
      # --init none keeps /nix out of ~/.nix-profile's way; the daemon is then
      # ours to start (see ensure_nix_daemon).
      local init_args=()
      if [ ! -d /run/systemd/system ]; then
        log "no init system detected — installing with --init none"
        init_args=(--init none)
      fi
      log "installing nix (determinate, linux planner)"
      curl -fsSL https://install.determinate.systems/nix |
        sh -s -- install linux "${init_args[@]}" --no-confirm
      ;;
    *) die "unsupported platform: $(uname -s)" ;;
  esac

  load_nix_profile || die "nix installed but no profile script found"
  have_nix || die "nix installed but not on PATH"
}

# With --init none there's nothing to launch nix-daemon, and a multi-user client
# can't build without it. Start it ourselves; harmless everywhere else.
ensure_nix_daemon() {
  [ "$(uname -s)" = Linux ] || return 0
  [ -d /run/systemd/system ] && return 0
  [ -S /nix/var/nix/daemon-socket/socket ] && return 0

  local daemon=/nix/var/nix/profiles/default/bin/nix-daemon
  [ -x "$daemon" ] || return 0

  log "starting nix-daemon"
  if [ "$(id -u)" = 0 ]; then
    setsid "$daemon" >/var/log/nix-daemon.log 2>&1 &
  else
    sudo setsid "$daemon" >/dev/null 2>&1 &
  fi

  # Give it a moment to bind the socket before anything tries to build.
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    [ -S /nix/var/nix/daemon-socket/socket ] && return 0
    sleep 1
  done
  warn "nix-daemon socket did not appear — builds may fail"
}

# exe.dev runs /exe.dev/setup as root, but the configuration belongs to the
# login user. Nix needed root; home-manager must not have it.
handoff_from_root() {
  [ "$(id -u)" = 0 ] || return 0

  local target="${TARGET_USER:-}"
  if [ -z "$target" ]; then
    local candidate
    for candidate in exedev "${SUDO_USER:-}"; do
      if [ -n "$candidate" ] && id "$candidate" >/dev/null 2>&1; then
        target="$candidate"
        break
      fi
    done
  fi

  if [ -z "$target" ] || [ "$target" = root ]; then
    warn "running as root with no unprivileged target user — configuring /root"
    return 0
  fi

  # printf %q so paths with spaces or quotes survive su's re-parse.
  local env_args=(
    "DOTFILES_REMOTE=$DOTFILES_REMOTE"
    "BOOTSTRAP_URL=$BOOTSTRAP_URL"
  )
  if [ -n "${DOTFILES_ROOT:-}" ]; then
    env_args+=("DOTFILES_ROOT=$DOTFILES_ROOT")
  fi
  if [ -n "${HM_CONFIG:-}" ]; then
    env_args+=("HM_CONFIG=$HM_CONFIG")
  fi

  log "handing off to $target"
  exec su - "$target" -c \
    "curl -fsSL $(printf '%q' "$BOOTSTRAP_URL") | env $(printf '%q ' "${env_args[@]}")bash"
}

enable_flakes() {
  mkdir -p "$HOME/.config/nix"
  if ! grep -qs 'experimental-features.*flakes' "$HOME/.config/nix/nix.conf"; then
    log "enabling flakes"
    echo 'experimental-features = nix-command flakes' >>"$HOME/.config/nix/nix.conf"
  fi
}

clone_dotfiles() {
  local root=$1

  if [ -d "$root/.git" ]; then
    log "dotfiles already at $root"
    return
  fi

  command -v git >/dev/null 2>&1 || die "git is required to clone the dotfiles"
  log "cloning $DOTFILES_REMOTE -> $root"
  mkdir -p "$(dirname "$root")"
  git clone "$DOTFILES_REMOTE" "$root"
}

apply_home_manager() {
  local root=$1
  local config="${HM_CONFIG:-}"

  if [ -z "$config" ]; then
    config="$(id -un)@$(nix eval --raw --impure --expr 'builtins.currentSystem')"
  fi

  log "applying home-manager configuration: $config"
  # The CLI comes from this repo's lockfile, not home-manager/master, so it
  # can't drift from the modules it is applying.
  nix run "$root#home-manager" -- switch --flake "$root#$config" -b hm-bak
}

ensure_profile_on_path() {
  echo "$PATH" | tr ':' '\n' | grep -qx "$HOME/.nix-profile/bin" && return 0

  # Standalone home-manager installs into ~/.nix-profile/bin. If that isn't on
  # PATH, nothing it installs is visible.
  # shellcheck disable=SC2016  # written verbatim into ~/.profile, expanded there
  local line='export PATH="$HOME/.nix-profile/bin:$PATH"'
  if ! grep -qsF "$line" "$HOME/.profile"; then
    log "adding ~/.nix-profile/bin to PATH via ~/.profile"
    printf '\n%s\n' "$line" >>"$HOME/.profile"
  fi
  warn "open a new shell, or run: $line"
}

main() {
  local root="${DOTFILES_ROOT:-$HOME/development/dotfiles}"

  install_nix
  ensure_nix_daemon
  handoff_from_root
  enable_flakes
  clone_dotfiles "$root"
  apply_home_manager "$root"
  ensure_profile_on_path

  log "done — $root is live; edits to CLAUDE.md and skills apply immediately"
}

main "$@"
