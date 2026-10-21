{ config, lib, pkgs, ... }:

let
  development = "${config.home.homeDirectory}/development";

  # Private repo, cloned next to this one. It stays a git checkout so skill edits
  # are live. Its install.sh owns everything that isn't a plain skill directory,
  # such as bruno-probe.
  repo = "${development}/dotfiles-proposales";
  skills = "${repo}/skills";
in
{
  # macOS only: it relies on the Keychain for the private repo's SSH key.
  # Everything happens at activation, not as home.file entries: listing the
  # dotfiles-proposales skills from Nix would fetch the private repo on every
  # evaluation. Network failures warn instead of failing the switch.
  home.activation.proposalesSkills = lib.mkIf pkgs.stdenv.isDarwin (lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    export PATH="${lib.makeBinPath [ pkgs.git ]}:$PATH"
    # Activation's PATH has no ssh. macOS's own reads keys from the Keychain.
    export GIT_SSH_COMMAND=/usr/bin/ssh

    if [ -d "${repo}/.git" ]; then
      run git -C "${repo}" pull --ff-only || warnEcho "could not update ${repo}"
    else
      run git clone git@github.com:SimonHylander/dotfiles-proposales.git "${repo}" \
        || warnEcho "could not clone dotfiles-proposales"
    fi

    for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
      run mkdir -p "$dest"

      # Drop links to skills removed from dotfiles-proposales.
      for link in "$dest"/*; do
        [ -L "$link" ] && [ ! -e "$link" ] || continue
        case "$(readlink "$link")" in
          "${skills}/"*) run rm "$link" ;;
        esac
      done

      for skill in "${skills}"/*/; do
        [ -f "$skill/SKILL.md" ] || continue
        target="$dest/$(basename "$skill")"
        # A real directory belongs to another installer, such as install.sh.
        if [ -e "$target" ] && [ ! -L "$target" ]; then
          warnEcho "skipping $(basename "$skill"): $target is not a symlink"
          continue
        fi
        run ln -sfn "''${skill%/}" "$target"
      done
    done

    if [ -f "${repo}/install.sh" ]; then
      run bash "${repo}/install.sh" || warnEcho "${repo}/install.sh failed"
    fi
  '');
}
