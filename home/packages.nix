{ pkgs, ... }:

{
  home.packages = with pkgs; [
    ripgrep
    fd
    fzf
    jq
    tree
    curl

    # Plain packages, not programs.*: those modules would write a second config
    # location (~/.config/git/config, ~/.config/gh/config.yml) alongside the
    # ~/.gitconfig and ~/.config/gh that already exist, and identity is
    # deliberately left unmanaged since it differs per machine.
    git
    gh
  ];

  # Worth the module: it wires nix-direnv's caching for you.
  # The shell hook is not installed here, because zsh isn't managed —
  # scripts/bootstrap.sh appends it to ~/.zshrc / ~/.bashrc.
  programs.direnv = {
    enable = true;
    nix-direnv.enable = true;
  };
}
