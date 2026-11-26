{ config, lib, impeccable, ... }:

let
  # Where this repo is checked out. Out-of-store symlinks can't reference the
  # flake's own source path, so the location is a convention: it's where the
  # repo already lives on the Mac, and where bootstrap.sh clones it on a VM.
  repo = "${config.home.homeDirectory}/development/dotfiles";

  link = path: config.lib.file.mkOutOfStoreSymlink "${repo}/${path}";

  # Subagent files directly under `dir`.
  agentFiles = dir:
    builtins.attrNames (lib.filterAttrs
      (name: type: type == "regular" && lib.hasSuffix ".md" name)
      (builtins.readDir dir));

  # Listed from the flake source, so a new agent needs `git add` and a switch.
  # Links point at the checkout, so edits to an existing agent are live.
  own = lib.genAttrs (agentFiles ../.agents/agents)
    (name: link ".agents/agents/${name}");

  # Claude Code subagents the impeccable skill delegates to.
  impeccableAgents = lib.genAttrs (agentFiles "${impeccable}/.claude/agents")
    (name: "${impeccable}/.claude/agents/${name}");
in
{
  # Individual leaves only — never ~/.claude or ~/.agents wholesale. Claude Code
  # writes runtime state (sessions/, projects/, history.jsonl, daemon.log) into
  # the same directory it reads config from, so those must stay real directories.
  home.file = {
    "AGENTS.md".source = link "AGENTS.md";

    ".claude/CLAUDE.md".source = link "AGENTS.md";
    ".claude/settings.json".source = link ".claude/settings.json";

    ".agents/AGENTS.md".source = link "AGENTS.md";
    ".codex/AGENTS.md".source = link "AGENTS.md";

    # The vendored pstack skills (arena, architect, swarm, how, why, reflect)
    # read their per-role models from this path, Cursor or not.
    ".cursor/rules/pstack-models.mdc".source = link ".agents/pstack-models.mdc";
  }
  # One link per agent, like skills: `npx impeccable install` also writes
  # into ~/.claude/agents.
  // lib.mapAttrs' (name: source: lib.nameValuePair ".claude/agents/${name}" { inherit source; })
    (impeccableAgents // own)
  // lib.mapAttrs' (name: source: lib.nameValuePair ".agents/agents/${name}" { inherit source; })
    own;

  # Migration from the directory-level agents link. home-manager links new
  # files before removing old ones, so it would write through that link into
  # this checkout. Remove once every machine has switched.
  home.activation.removeAgentsDirLinks = lib.hm.dag.entryBefore [ "checkLinkTargets" ] ''
    for dir in "$HOME/.claude/agents" "$HOME/.agents/agents"; do
      [ -L "$dir" ] && run rm "$dir"
    done
    true
  '';
}
