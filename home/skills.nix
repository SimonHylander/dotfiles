{ config, lib, mattpocock-skills, ... }:

let
  repo = "${config.home.homeDirectory}/development/dotfiles";

  # Names of the skill directories directly under `dir`.
  skillNames = dir:
    builtins.attrNames (lib.filterAttrs
      (name: type: type == "directory" && builtins.pathExists (dir + "/${name}/SKILL.md"))
      (builtins.readDir dir));

  # Every bucket except deprecated/. Links point into the store, so these
  # update on `nix flake update`, not on `git pull`.
  mattpocock = lib.concatMapAttrs
    (bucket: type:
      lib.optionalAttrs (type == "directory" && bucket != "deprecated") (lib.genAttrs
        (skillNames "${mattpocock-skills}/skills/${bucket}")
        (name: "${mattpocock-skills}/skills/${bucket}/${name}")))
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

  # Migration from the old link scripts. Their symlinks sit where home-manager
  # now puts its own, and `-b hm-bak` would keep them as duplicate
  # `<name>.hm-bak` skills. Remove once every machine has switched.
  home.activation.removeScriptSkillLinks = lib.hm.dag.entryBefore [ "checkLinkTargets" ] ''
    for dest in "$HOME/.claude/skills" "$HOME/.agents/skills"; do
      for link in "$dest"/*; do
        [ -L "$link" ] || continue
        case "$(readlink "$link")" in
          "${repo}/.agents/skills/"* | "${config.home.homeDirectory}/development/mattpocock-skills/"*)
            run rm "$link"
            ;;
        esac
      done
    done
  '';
}
