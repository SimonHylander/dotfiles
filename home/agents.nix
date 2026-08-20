{ config, lib, pkgs, ... }:

let
  # Where this repo is checked out. Out-of-store symlinks can't reference the
  # flake's own source path, so the location is a convention: it's where the
  # repo already lives on the Mac, and where bootstrap.sh clones it on a VM.
  repo = "${config.home.homeDirectory}/development/dotfiles";

  # mattpocock/skills checkout, kept live so `git pull` updates the linked
  # skills. Not ~/development/skills — that path is SimonHylander/skills.
  skillsRepo = "${config.home.homeDirectory}/development/mattpocock-skills";

  link = path: config.lib.file.mkOutOfStoreSymlink "${repo}/${path}";
in
{
  # Individual leaves only — never ~/.claude or ~/.agents wholesale. Claude Code
  # writes runtime state (sessions/, projects/, history.jsonl, daemon.log) into
  # the same directory it reads config from, so those must stay real directories.
  home.file = {
    "CLAUDE.md".source = link "CLAUDE.md";
    "AGENTS.md".source = link "AGENTS.md";

    ".claude/CLAUDE.md".source = link "CLAUDE.md";
    ".claude/settings.json".source = link ".claude/settings.json";

    # Unlike skills/, nothing writes into agents/ and no external script claims
    # entries there, so one directory-level link beats enumerating each file.
    # Single source in .agents/agents, mirrored into both harness directories
    # the same way skills are.
    ".claude/agents".source = link ".agents/agents";
    ".agents/agents".source = link ".agents/agents";

    ".agents/AGENTS.md".source = link "AGENTS.md";
    ".codex/AGENTS.md".source = link "AGENTS.md";
  };

  # Skills need dynamic enumeration and have to interoperate with an external
  # script that rewrites the same directories, so they're an activation step
  # rather than home.file entries.
  home.activation.syncSkills = lib.hm.dag.entryAfter [ "writeBoundary" ] ''
    export PATH="${lib.makeBinPath [ pkgs.git pkgs.coreutils pkgs.findutils ]}:$PATH"
    export DOTFILES_ROOT="${repo}"
    export SKILLS_REPO="${skillsRepo}"
    $DRY_RUN_CMD ${repo}/scripts/sync-skills.sh
  '';
}
