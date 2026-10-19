# Dotfiles

Agent configuration and a lean base toolchain, managed with [home-manager](https://github.com/nix-community/home-manager).
One flake, one target: macOS (`aarch64-darwin`).

## First install

On a fresh machine or VM:

```sh
curl -fsSL https://raw.githubusercontent.com/SimonHylander/dotfiles/main/scripts/bootstrap.sh | bash
```

That installs Nix if missing, enables flakes, clones this repo to `~/development/dotfiles`,
and applies the home-manager configuration. It is idempotent — re-run it any time.

### On an exe.dev VM

`/exe.dev/setup` runs once at first boot. Setup scripts are size-limited, so
`scripts/exe-setup.sh` is a stub that fetches the bootstrap:

```sh
# one VM
cat scripts/exe-setup.sh | ssh exe.dev new --name my-vm --setup-script /dev/stdin

# or as the default for every future VM
cat scripts/exe-setup.sh | ssh exe.dev defaults write dev.exe new.setup-script
```

Because it only runs at first boot, iterating on a failed setup means SSHing in and running
`bootstrap.sh` by hand rather than recreating the VM.

## Day to day

```sh
cd ~/development/dotfiles
nix run .#home-manager -- switch \
  --flake .#"$(id -un)@$(nix eval --raw --impure --expr 'builtins.currentSystem')" \
  -b hm-bak
```

`nix flake check` builds the configuration first, so evaluation errors surface before a switch.

`nix run .#home-manager` uses the CLI pinned in this `flake.lock`, so it can never drift from the
modules it is applying. **`-b hm-bak` is not optional**: standalone home-manager has no
`home.backupFileExtension` option (that belongs to the nix-darwin/NixOS module), so without the
flag the first switch aborts on any managed path that already exists as a real file.

Editing `CLAUDE.md`, `AGENTS.md`, `.claude/settings.json` or any skill takes effect
**immediately** — the links point at this checkout, not at the Nix store. A `switch` is only
needed after changing something under `home/`, adding a skill, or updating
mattpocock/skills with `nix flake update mattpocock-skills`.

## What gets linked

`~/.claude` and `~/.agents` stay real directories — Claude Code writes runtime state
(`sessions/`, `projects/`, `history.jsonl`) into the same tree it reads config from, and other
installers also write into the skill directories. So individual leaves are managed,
never a whole directory:

```text
~/CLAUDE.md                  -> <repo>/CLAUDE.md
~/AGENTS.md                  -> <repo>/AGENTS.md
~/.claude/CLAUDE.md          -> <repo>/AGENTS.md
~/.claude/settings.json      -> <repo>/.claude/settings.json
~/.agents/AGENTS.md          -> <repo>/AGENTS.md
~/.codex/AGENTS.md           -> <repo>/AGENTS.md
~/.claude/agents             -> <repo>/.agents/agents
~/.agents/agents             -> <repo>/.agents/agents
~/.claude/skills/<skill>     -> <repo>/.agents/skills/<skill>  or  <store>/mattpocock-skills/...
~/.agents/skills/<skill>     -> <repo>/.agents/skills/<skill>  or  <store>/mattpocock-skills/...
```

Pre-existing real files are moved aside with a `.hm-bak` suffix on first switch, not
overwritten. Each link is two hops — `~/CLAUDE.md` → a store `home-manager-files` entry → the
checkout — which is how `mkOutOfStoreSymlink` works; the final target is always this repo.

`~/.claude` itself is never linked, so `sessions/`, `projects/`, `history.jsonl` and `plugins/`
are untouched.

### Skills

`home/skills.nix` gives every skill its own link in both skill directories:

- **This repo's skills** link to the checkout, so edits are live. They are listed from the flake
  source, so a new skill shows up after `git add` and a switch.
- **[mattpocock/skills](https://github.com/mattpocock/skills)** is a flake input pinned in
  `flake.lock`, linked from the store. Every bucket except `deprecated/` is linked. Update with
  `nix flake update mattpocock-skills`.

This repo wins name collisions. home-manager removes links to skills that no longer exist on
the next switch.

**Proposales skills (macOS only).** `home/proposales.nix` clones or pulls two private repos next
to this one, `~/development/dotfiles-proposales` and
[`~/development/bruno-probe`](https://github.com/proposales/bruno-probe), and links every
`dotfiles-proposales/skills/<skill>` at activation. Listing those skills from Nix would fetch the
private repo on every evaluation. The upstream `claude/bruno-probe.md` is copied to
`bruno-probe/SKILL.md` on each switch, because Codex skips a `SKILL.md` that is a symlink. Set `BRUNO_COLLECTIONS` to the proposales repo's `bruno-collections/`
folder, because the checkout isn't at the runner's default path.

## Machine-local settings

`.claude/settings.json` here holds only what is portable. Anything machine-specific — the
cmux-mood `UserPromptSubmit` hook on macOS, permission allowlists — belongs in
`~/.claude/settings.local.json`, which Claude Code merges over it and which is gitignored.
Shipping the macOS hook path in the tracked file would make every prompt submission on a Linux
VM error.

Shell configuration is deliberately unmanaged: `~/.zshrc` contains live credentials and would
need `sops-nix`/`agenix` or an untracked `~/.zshrc.local` before it could be committed. One
consequence — direnv comes from `home/packages.nix`, but its shell hook is appended to
`~/.zshrc` / `~/.bashrc` by `scripts/bootstrap.sh` (idempotent), not by home-manager.

## Layout

```text
flake.nix                 nixpkgs + home-manager, one homeConfiguration per target
home/
  default.nix             stateVersion, backup policy, platform imports
  agents.nix              CLAUDE.md / AGENTS.md / .claude leaves
  skills.nix              per-skill links into ~/.claude/skills and ~/.agents/skills
  packages.nix            cross-platform toolchain
  darwin.nix              macOS-only (deliberately minimal — Homebrew owns the rest)
  proposales.nix          macOS-only: private sibling checkouts + their skill links
  linux.nix               Linux-only (node, pnpm, neovim, claude-code)
scripts/
  bootstrap.sh            first install: nix -> clone -> switch
  exe-setup.sh            /exe.dev/setup stub
CLAUDE.md  AGENTS.md      agent guidance, single source each
.claude/                  settings.json
.agents/agents/           subagent definitions, linked into both harness dirs
.agents/skills/           this repo's own skills
```
