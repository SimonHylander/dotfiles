{
  description = "Simon Hylander's dotfiles";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";

    home-manager = {
      url = "github:nix-community/home-manager";
      inputs.nixpkgs.follows = "nixpkgs";
    };
  };

  outputs = { nixpkgs, home-manager, ... }:
    let
      supportedSystems = [ "aarch64-darwin" "x86_64-linux" "aarch64-linux" ];
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
          extraSpecialArgs = { inherit system username homeDirectory; };
          modules = [ ./home ];
        };
    in
    {
      # The home-manager CLI from this lockfile, so applying the config can't
      # drift from the modules it was evaluated against:
      #   nix run .#home-manager -- switch --flake .#<config> -b hm-bak
      packages = forAllSystems (system: {
        home-manager = home-manager.packages.${system}.default;
        default = home-manager.packages.${system}.default;
      });

      homeConfigurations = {
        "simonhylander@aarch64-darwin" = mkHome {
          system = "aarch64-darwin";
          username = "simonhylander";
          homeDirectory = "/Users/simonhylander";
        };

        # exe.dev VMs log in as `exedev`. The docs don't pin an architecture,
        # so both are generated.
        "exedev@x86_64-linux" = mkHome {
          system = "x86_64-linux";
          username = "exedev";
          homeDirectory = "/home/exedev";
        };

        "exedev@aarch64-linux" = mkHome {
          system = "aarch64-linux";
          username = "exedev";
          homeDirectory = "/home/exedev";
        };
      };
    };
}
