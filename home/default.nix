{ lib, system, username, homeDirectory, ... }:

let
  # Branch on `system`, not `pkgs.stdenv` — referencing pkgs from `imports`
  # is an infinite recursion, since pkgs comes from the module system itself.
  isDarwin = lib.hasSuffix "darwin" system;
in
{
  imports = [
    ./packages.nix
    ./agents.nix
    (if isDarwin then ./darwin.nix else ./linux.nix)
  ];

  home.username = username;
  home.homeDirectory = homeDirectory;
  home.stateVersion = "25.05";

  # NOTE: ~/.claude/CLAUDE.md and ~/.claude/settings.json already exist as real
  # files on an established machine, and the first `switch` aborts on each of
  # them unless it is told to move them aside. Standalone home-manager has no
  # `home.backupFileExtension` option (that one belongs to the nix-darwin/NixOS
  # module), so it must come from the CLI: always switch with `-b hm-bak`.
  # scripts/bootstrap.sh does this for you.

  programs.home-manager.enable = true;
}
