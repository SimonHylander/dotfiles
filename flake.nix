{
  description = "Simon Hylander's dotfiles";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };

    # Linked straight from the store by home/skills.nix. Bump with
    # `nix flake update mattpocock-skills`.
    mattpocock-skills = {
      url = "github:mattpocock/skills";
      flake = false;
    };
  };

  outputs = { self, nixpkgs, home-manager, mattpocock-skills, ... }:
    let
      supportedSystems = [ "aarch64-darwin" ];
      forAllSystems = nixpkgs.lib.genAttrs supportedSystems;

      # Narrow rather than blanket allowUnfree: claude-code is the only
      # unfree package here, and an accidental second one should still fail.
      unfreeAllowed = [ "claude-code" ];

      mkHome = { system, username, homeDirectory }:
        home-manager.lib.homeManagerConfiguration {
          pkgs = import nixpkgs {
            inherit system;
            config.allowUnfreePredicate = pkg:
              builtins.elem (nixpkgs.lib.getName pkg) unfreeAllowed;
          };
          modules = [
            self.homeModules.default
            {
              home.username = username;
              home.homeDirectory = homeDirectory;
            }
          ];
        };
    in
    {
      # The whole configuration as one module, for this flake's standalone
      # homeConfigurations and for NixOS hosts that import home-manager's NixOS
      # module. The host sets the username and home directory.
      homeModules.default = {
        imports = [ ./home ];
        _module.args = { inherit mattpocock-skills; };
      };

      # The home-manager CLI from this lockfile, so applying the config can't
      # drift from the modules it was evaluated against:
      #   nix run .#home-manager -- switch --flake .#<config> -b hm-bak
      packages = forAllSystems (system: {
        home-manager = home-manager.packages.${system}.default;
        default = home-manager.packages.${system}.default;
      });

      # `nix flake check` builds every home configuration for the current
      # system, so an evaluation error shows up before a switch.
      checks = forAllSystems (system:
        nixpkgs.lib.mapAttrs (_: config: config.activationPackage)
          (nixpkgs.lib.filterAttrs (name: _: nixpkgs.lib.hasSuffix "@${system}" name)
            self.homeConfigurations));

      homeConfigurations = {
        "simonhylander@aarch64-darwin" = mkHome {
          system = "aarch64-darwin";
          username = "simonhylander";
          homeDirectory = "/Users/simonhylander";
        };
      };
    };
}
