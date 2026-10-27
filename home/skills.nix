{ config, lib, pkgs, mattpocock-skills, ... }:

let
  repo = "${config.home.homeDirectory}/development/dotfiles";
  mattpocockRepo = "${config.home.homeDirectory}/development/mattpocock-skills";

  # Names of the skill directories directly under `dir`.
  skillNames = dir:
    builtins.attrNames (lib.filterAttrs
      (name: type: type == "directory" && builtins.pathExists (dir + "/${name}/SKILL.md"))
      (builtins.readDir dir));

  # Every bucket except deprecated/. Listed from the locked input, so a new
  # skill needs `nix flake update mattpocock-skills` and a switch. Links point
  # at the checkout, so a `git pull` there updates an existing skill.
  mattpocock = lib.concatMapAttrs
    (bucket: type:
      lib.optionalAttrs (type == "directory" && bucket != "deprecated") (lib.genAttrs
        (skillNames "${mattpocock-skills}/skills/${bucket}")
        (name: config.lib.file.mkOutOfStoreSymlink "${mattpocockRepo}/skills/${bucket}/${name}")))
    (builtins.readDir "${mattpocock-skills}/skills");

  # Listed from the flake source, so a new skill needs `git add` and a switch.
  # Links point at the checkout, so edits to an existing skill are live.
  own = lib.genAttrs (skillNames ../.agents/skills)
    (name: config.lib.file.mkOutOfStoreSymlink "${repo}/.agents/skills/${name}");

  # Ours win name collisions (handoff, retro, tdd, teach).
  skills = mattpocock // own;
in
{
  # One link per skill, never the whole directory: other installers
  # (`npx skills`, plugins) also write into ~/.claude/skills and ~/.agents/skills.
  home.file = lib.concatMapAttrs
    (name: source: {
      ".claude/skills/${name}".source = source;
      ".agents/skills/${name}".source = source;
    })
    skills;

  # Clone the mattpocock/skills checkout on the first switch and pull it on
  # each switch after. Runs after the dotfiles checkout when the host defines
  # one (system's modules/home.nix does). A failed clone or pull warns instead
  # of failing the switch.
  home.activation.mattpocockSkillsCheckout = lib.hm.dag.entryBetween [ "linkGeneration" ] [ "writeBoundary" "dotfilesCheckout" ] ''
    export PATH="${lib.makeBinPath [ pkgs.git ]}:$PATH"
    if [ -d "${mattpocockRepo}/.git" ]; then
      run git -C "${mattpocockRepo}" pull --ff-only || warnEcho "could not update ${mattpocockRepo}"
    else
      run git clone https://github.com/mattpocock/skills "${mattpocockRepo}" \
        || warnEcho "could not clone mattpocock/skills"
    fi
  '';

  # Migration from the old link scripts. Their symlinks sit where home-manager
  # now puts its own, and `-b hm-bak` would keep them as duplicate
  # `<name>.hm-bak` skills. Matches any dotfiles checkout, because some
  # machines ran the scripts from another path. Remove once every machine has
  # switched.
  home.activation.removeScriptSkillLinks = lib.hm.dag.entryBefore [ "checkLinkTargets" ] ''
    for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
      for link in "$dest"/*; do
        [ -L "$link" ] || continue
        case "$(readlink "$link")" in
          */dotfiles/.agents/skills/* | */dotfiles/proposales/skills/* | \
          "${config.home.homeDirectory}/development/mattpocock-skills/"*)
            run rm "$link"
            ;;
        esac
      done
    done
  '';
}
