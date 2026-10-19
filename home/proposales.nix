{ config, lib, pkgs, ... }:

let
  development = "${config.home.homeDirectory}/development";
  skills = "${development}/dotfiles/proposales/skills";
  brunoProbe = "${development}/bruno-probe";
in
{
  # Both sources are private, so this is macOS only and runs at activation
  # instead of as home.file entries. Listing the submodule's skills from Nix
  # would fetch it over SSH on every evaluation, and bruno-probe must stay a
  # git checkout because its runner writes runs/ next to itself. The
  # bruno-probe skill is a symlink from the submodule into that checkout.
  # Network failures warn instead of failing the switch.
  home.activation.proposalesSkills = lib.hm.dag.entryAfter [ "linkGeneration" ] ''
    export PATH="${lib.makeBinPath [ pkgs.git ]}:$PATH"

    if [ -d "${brunoProbe}/.git" ]; then
      run git -C "${brunoProbe}" pull --ff-only || warnEcho "could not update ${brunoProbe}"
    else
      run git clone git@github.com:proposales/bruno-probe.git "${brunoProbe}" ||
        warnEcho "could not clone proposales/bruno-probe"
    fi

    for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
      run mkdir -p "$dest"

      # Drop links to skills removed from the submodule.
      for link in "$dest"/*; do
        [ -L "$link" ] && [ ! -e "$link" ] || continue
        case "$(readlink "$link")" in
          "${skills}/"*) run rm "$link" ;;
        esac
      done

      # -f follows the bruno-probe symlink, so it is skipped without the checkout.
      for skill in "${skills}"/*/; do
        [ -f "$skill/SKILL.md" ] || continue
        run ln -sfn "''${skill%/}" "$dest/$(basename "$skill")"
      done
    done
  '';
}
