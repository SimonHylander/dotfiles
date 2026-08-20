{ pkgs, ... }:

{
  # A fresh exe.dev VM has none of this, so unlike Darwin it gets the full set.
  home.packages = with pkgs; [
    nodejs_22
    pnpm
    neovim
    claude-code
  ];
}
