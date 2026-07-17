# Dotfiles

## Apply symlinks

This repository exposes an installer through its Nix flake:

```sh
nix run .
```

Run it from the repository root. It currently creates:

```text
~/.claude/skills -> <repo>/.agents/skills
```

The installer is idempotent. It stops instead of replacing an existing file, directory, or unexpected symlink.

`nix build` only builds the installer because Nix builds cannot modify `$HOME`. To build first and apply it separately:

```sh
nix build
DOTFILES_ROOT="$PWD" ./result/bin/apply-dotfiles
```
