_:

{
  # Node, pnpm, neovim and the agent CLIs aren't installed here. Homebrew owns
  # them on the Mac and the NixOS host config owns them on Linux, and copies
  # from here would shadow those. Only the cross-platform tools in
  # packages.nix apply.
  imports = [
    ./packages.nix
    ./agents.nix
    ./skills.nix
    ./proposales.nix
  ];

  home.stateVersion = "25.05";

  # NOTE: ~/.claude/CLAUDE.md and ~/.claude/settings.json already exist as real
  # files on an established machine, and the first `switch` aborts on each of
  # them unless it is told to move them aside. Standalone home-manager has no
  # `home.backupFileExtension` option (that one belongs to the nix-darwin/NixOS
  # module), so it must come from the CLI: always switch with `-b hm-bak`.
  # scripts/bootstrap.sh does this for you.

  programs.home-manager.enable = true;
}
