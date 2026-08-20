_:

{
  # Intentionally minimal. Node, pnpm, bun and neovim already come from Homebrew
  # on this machine, and nix copies would shadow them unpredictably given the
  # PATH order in ~/.zshrc. Only the cross-platform tools in packages.nix apply.
  home.packages = [ ];
}
