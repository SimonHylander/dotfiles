{ config, lib, pkgs, ... }:

let
  development = "${config.home.homeDirectory}/development";

  # Private repos, cloned next to this one. They stay git checkouts: skill
  # edits are live, and bruno-probe's runner writes runs/ next to itself.
  repos = {
    dotfiles-proposales = "git@github.com:SimonHylander/dotfiles-proposales.git";
    bruno-probe = "git@github.com:proposales/bruno-probe.git";
  };

  skills = "${development}/dotfiles-proposales/skills";
  brunoProbeCommand = "${development}/bruno-probe/claude/bruno-probe.md";
in
{
  # Everything happens at activation, not as home.file entries: listing the
  # dotfiles-proposales skills from Nix would fetch the private repo on every
  # evaluation. Network failures warn instead of failing the switch.
  home.activation.proposalesSkills = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    export PATH="${lib.makeBinPath [ pkgs.git ]}:$PATH"
    # Activation's PATH has no ssh. macOS's own reads keys from the Keychain.
    export GIT_SSH_COMMAND=/usr/bin/ssh

    ${lib.concatStrings (lib.mapAttrsToList (name: url: ''
      if [ -d "${development}/${name}/.git" ]; then
        run git -C "${development}/${name}" pull --ff-only || warnEcho "could not update ${development}/${name}"
      else
        run git clone ${url} "${development}/${name}" || warnEcho "could not clone ${url}"
      fi
    '') repos)}

    for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
      run mkdir -p "$dest"

      # Upstream ships a Claude command file, not a skill directory. It is
      # copied, not linked, because Codex skips a SKILL.md that is a symlink.
      if [ -f "${brunoProbeCommand}" ]; then
        [ -L "$dest/bruno-probe" ] && run rm "$dest/bruno-probe"
        run mkdir -p "$dest/bruno-probe"
        run install -m 644 "${brunoProbeCommand}" "$dest/bruno-probe/SKILL.md"
      fi

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
        # A real directory belongs to another installer, or is bruno-probe.
        if [ -e "$target" ] && [ ! -L "$target" ]; then
          warnEcho "skipping $(basename "$skill"): $target is not a symlink"
          continue
        fi
        run ln -sfn "''${skill%/}" "$target"
      done
    done
  '';
}
