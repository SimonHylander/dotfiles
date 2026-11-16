#!/usr/bin/env bun
/**
 * Retention rules per data class for this Mac.
 *
 *   bun disk-cleanup.ts                     report only, deletes nothing
 *   bun disk-cleanup.ts --apply             run tier 1 when container free space is under --floor-gb (default 10)
 *   bun disk-cleanup.ts --apply --rules=a,b run the named tier 1 or 2 rules, ignoring the floor
 *
 * Tier 1: the owning tool's own cleanup command. Data regenerates.
 * Tier 2: age-based removal of regenerable data that has no cleanup command.
 * Tier 3: report only. Removal can lose work or state, so apply never runs it.
 */
import { $ } from "bun";
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";

const HOME = homedir();
const DAY_MS = 86_400_000;
const LOG_DIR = join(HOME, "Library/Logs/disk-cleanup");

/** Retention windows in days. */
const RETAIN_DAYS = {
  npx: 7,
  brew: 7,
  updaters: 7,
  appCaches: 7,
  buildOutput: 7,
  worktrees: 7,
  t3Scratch: 7,
  stateFiles: 7,
} as const satisfies Record<string, number>;

const { values: flags } = parseArgs({
  options: {
    apply: { type: "boolean", default: false },
    rules: { type: "string" },
    "floor-gb": { type: "string", default: "10" },
    out: { type: "string", default: join(LOG_DIR, "last-report.json") },
    log: { type: "string", default: join(LOG_DIR, "apply.jsonl") },
  },
});

type Tier = 1 | 2 | 3;
type Undo = "regenerates" | "redownload" | "reinstall" | "lost";

type Candidate = {
  target: string;
  bytes: number;
  why: string;
  /** argv that apply runs. For tier 3 it is the command to run after approval. */
  action: readonly string[];
  cwd?: string;
  /** The tool decides what it removes, so `bytes` is the most it can free. */
  upperBound?: boolean;
};

type Scan = { candidates: Candidate[]; blocked?: Candidate[] };

type Rule = {
  id: string;
  tier: Tier;
  undo: Undo;
  signal: string;
  scan: () => Promise<Scan>;
};

// ---------- helpers ----------

const gb = (bytes: number) => `${(bytes / 1e9).toFixed(2)} GB`;
const sum = (xs: Iterable<number>) => [...xs].reduce((a, b) => a + b, 0);
const ageDays = (path: string) => (Date.now() - statSync(path).mtimeMs) / DAY_MS;
const children = (dir: string) => (existsSync(dir) ? readdirSync(dir).map((name) => join(dir, name)) : []);
const isDir = (path: string) => existsSync(path) && statSync(path).isDirectory();
const once = <T>(f: () => Promise<T>) => {
  let p: Promise<T> | undefined;
  return () => (p ??= f());
};

const run = async (argv: readonly string[], cwd = HOME) =>
  (await $`${argv}`.cwd(cwd).nothrow().quiet()).stdout.toString().trim();

/** Allocated bytes per path, from one `du` call so hardlinks count once. */
async function allocated(paths: readonly string[]): Promise<Map<string, number>> {
  if (paths.length === 0) return new Map();
  const proc = Bun.spawn(["xargs", "-0", "du", "-sk"], {
    stdin: new Blob([paths.join("\0")]),
    stdout: "pipe",
    stderr: "ignore",
  });
  const out = await new Response(proc.stdout).text();
  return new Map(
    out
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const tab = line.indexOf("\t");
        return [line.slice(tab + 1), Number(line.slice(0, tab)) * 1024] as const;
      }),
  );
}

const sizeOf = async (path: string) => (existsSync(path) ? ((await allocated([path])).get(path) ?? 0) : 0);

async function mapLimit<T, R>(items: readonly T[], limit: number, f: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await f(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

const freeBytes = async () =>
  Number(await $`diskutil info -plist / | plutil -extract APFSContainerFree raw -`.quiet().text());

const rmCandidates = async (paths: readonly string[], why: (path: string) => string): Promise<Candidate[]> => {
  const sizes = await allocated(paths);
  return paths.map((path) => ({ target: path, bytes: sizes.get(path) ?? 0, why: why(path), action: ["rm", "-rf", path] }));
};

const appVersion = (app: string) => {
  const plist = join(app, "Contents/Info.plist");
  if (!existsSync(plist)) return undefined;
  const xml = readFileSync(plist, "utf8");
  return /<key>CFBundleShortVersionString<\/key>\s*<string>([^<]+)<\/string>/.exec(xml)?.[1];
};

const runningBundleIds = once(async () => {
  const out = await run(["lsappinfo", "list"]);
  return new Set([...out.matchAll(/bundleID="([^"]+)"/g)].map((m) => m[1]!));
});

// ---------- git worktrees ----------

type Worktree = { repo: string; path: string; branch?: string; main: boolean; prunable: boolean };

const repos = once(async () => children(join(HOME, "development")).filter((dir) => isDir(join(dir, ".git"))));

const worktrees = once(async (): Promise<Worktree[]> => {
  const all = await Promise.all(
    (await repos()).map(async (repo) => {
      const blocks = (await run(["git", "-C", repo, "worktree", "list", "--porcelain"])).split("\n\n").filter(Boolean);
      return blocks.map((block, i): Worktree => {
        const field = (key: string) =>
          block
            .split("\n")
            .find((l) => l === key || l.startsWith(`${key} `))
            ?.slice(key.length + 1);
        return {
          repo,
          path: field("worktree")!,
          branch: field("branch")?.replace("refs/heads/", ""),
          main: i === 0,
          prunable: field("prunable") !== undefined,
        };
      });
    }),
  );
  return all.flat();
});

/**
 * Newest of: last commit time, HEAD write time (checkout, commit, reset).
 * Not the index: editors and `git status` rewrite it without any real activity.
 */
async function lastActivityDays(wt: Worktree): Promise<number> {
  const commitSec = Number(await run(["git", "-C", wt.path, "log", "-1", "--format=%ct"]));
  const gitDir = await run(["git", "-C", wt.path, "rev-parse", "--absolute-git-dir"]);
  const headMs = existsSync(join(gitDir, "HEAD")) ? statSync(join(gitDir, "HEAD")).mtimeMs : 0;
  return (Date.now() - Math.max(commitSec * 1000, headMs)) / DAY_MS;
}

const prStates = once(async () => {
  const byRepo = new Map<string, Map<string, string>>();
  for (const repo of await repos()) {
    const json = await run(["gh", "pr", "list", "--state", "all", "--limit", "1000", "--json", "headRefName,state"], repo);
    const states = new Map<string, string>();
    try {
      for (const pr of JSON.parse(json) as { headRefName: string; state: string }[]) {
        if (states.get(pr.headRefName) !== "OPEN") states.set(pr.headRefName, pr.state);
      }
    } catch {
      // gh unavailable or repo has no GitHub remote: fall back to the ancestry check.
    }
    byRepo.set(repo, states);
  }
  return byRepo;
});

const linkedWorktrees = async () => (await worktrees()).filter((wt) => !wt.main && !wt.prunable && existsSync(wt.path));

// ---------- rules ----------

const rules: Rule[] = [
  {
    id: "nix-dead-paths",
    tier: 1,
    undo: "redownload",
    signal: "store path unreachable from every GC root",
    scan: async () => {
      const dead = (await run(["nix-store", "--gc", "--print-dead"])).split("\n").filter(Boolean);
      if (dead.length === 0) return { candidates: [] };
      const bytes = sum((await allocated(dead)).values());
      return {
        candidates: [{ target: `${dead.length} dead store paths`, bytes, why: "unreachable", action: ["nix-store", "--gc"] }],
      };
    },
  },
  {
    id: "bun-cache",
    tier: 1,
    undo: "redownload",
    signal: "whole cache; bun has no age-based prune",
    scan: async () => {
      const cache = join(HOME, ".bun/install/cache");
      if (!existsSync(cache)) return { candidates: [] };
      const roots = [join(HOME, "development"), join(HOME, ".t3/worktrees"), join(HOME, ".cursor/worktrees"), join(HOME, ".bun/install/global")];
      const overlap = JSON.parse(
        await run(["python3", "-I", join(import.meta.dir, "clone_overlap.py"), cache, ...roots.filter(existsSync)]),
      ) as { cache_bytes: number; shared_bytes: number; unshared_bytes: number };
      return {
        candidates: [
          {
            target: cache,
            bytes: overlap.unshared_bytes,
            why: `${gb(overlap.cache_bytes)} cache, ${gb(overlap.shared_bytes)} shared with node_modules clones stays allocated`,
            action: ["bun", "pm", "cache", "rm"],
          },
        ],
      };
    },
  },
  {
    id: "yarn-berry-mirror",
    tier: 1,
    undo: "redownload",
    signal: "whole global mirror; projects use nodeLinker node-modules, so installed trees do not read it",
    scan: async () => {
      const mirror = join(HOME, ".yarn/berry/cache");
      const project = join(HOME, "development/proposales");
      const bytes = await sizeOf(mirror);
      return bytes
        ? { candidates: [{ target: mirror, bytes, why: "yarn 4 global cache", action: ["yarn", "cache", "clean", "--mirror"], cwd: project }] }
        : { candidates: [] };
    },
  },
  {
    id: "npm-cache",
    tier: 1,
    undo: "redownload",
    signal: "whole content cache",
    scan: async () => {
      const cache = join(HOME, ".npm/_cacache");
      const bytes = await sizeOf(cache);
      return bytes ? { candidates: [{ target: cache, bytes, why: "npm content cache", action: ["npm", "cache", "clean", "--force"] }] } : { candidates: [] };
    },
  },
  {
    id: "pnpm-store",
    tier: 1,
    undo: "redownload",
    signal: "packages no project on disk links to (pnpm decides)",
    scan: async () => {
      const store = await run(["pnpm", "store", "path"]);
      if (!store || !existsSync(store)) return { candidates: [] };
      return {
        candidates: [
          { target: store, bytes: await sizeOf(store), why: "pnpm has no dry run; store size is the ceiling", action: ["pnpm", "store", "prune"], upperBound: true },
        ],
      };
    },
  },
  {
    id: "pnpm-old-store",
    tier: 2,
    undo: "redownload",
    signal: "store layout version the installed pnpm no longer reads",
    scan: async () => {
      const current = await run(["pnpm", "store", "path"]);
      if (!current) return { candidates: [] };
      const old = children(dirname(current)).filter((p) => isDir(p) && p !== current && /\/v\d+$/.test(p));
      return { candidates: await rmCandidates(old, () => `pnpm now uses ${current.split("/").pop()}`) };
    },
  },
  {
    id: "brew-cleanup",
    tier: 1,
    undo: "redownload",
    signal: `old versions and downloads older than ${RETAIN_DAYS.brew} days`,
    scan: async () => {
      const out = await run(["brew", "cleanup", "-n", `--prune=${RETAIN_DAYS.brew}`]);
      const m = /free approximately ([\d.]+)(KB|MB|GB)/.exec(out);
      if (!m) return { candidates: [] };
      const bytes = Number(m[1]) * { KB: 1e3, MB: 1e6, GB: 1e9 }[m[2] as "KB" | "MB" | "GB"];
      return { candidates: [{ target: "homebrew", bytes, why: "brew cleanup dry run", action: ["brew", "cleanup", `--prune=${RETAIN_DAYS.brew}`] }] };
    },
  },
  {
    id: "git-worktree-prune",
    tier: 1,
    undo: "regenerates",
    signal: "worktree folder already gone, git metadata left behind",
    scan: async () => {
      const prunable = (await worktrees()).filter((wt) => wt.prunable);
      const repoList = [...new Set(prunable.map((wt) => wt.repo))];
      return {
        candidates: repoList.map((repo) => ({
          target: repo,
          bytes: 0,
          why: `${prunable.filter((wt) => wt.repo === repo).length} stale worktree entries`,
          action: ["git", "-C", repo, "worktree", "prune"],
        })),
      };
    },
  },
  {
    id: "npx-cache",
    tier: 2,
    undo: "redownload",
    signal: `npx package folder unused for ${RETAIN_DAYS.npx} days`,
    scan: async () => {
      const stale = children(join(HOME, ".npm/_npx")).filter((p) => ageDays(p) > RETAIN_DAYS.npx);
      return { candidates: await rmCandidates(stale, (p) => `${Math.floor(ageDays(p))} days old`) };
    },
  },
  {
    id: "app-updaters",
    tier: 2,
    undo: "redownload",
    signal: `staged update already installed, or untouched for ${RETAIN_DAYS.updaters} days`,
    scan: async () => {
      const dirs = children(join(HOME, "Library/Caches")).filter((p) => /\.ShipIt$|-updater$/.test(p) && isDir(p));
      const stale = dirs.flatMap((dir): (readonly [string, string])[] => {
        const staged = Bun.spawnSync(["find", dir, "-maxdepth", "3", "-name", "*.app"]).stdout.toString().split("\n").filter(Boolean);
        const applied = staged.some((app) => {
          const stagedVersion = appVersion(app);
          const installedVersion = appVersion(join("/Applications", app.split("/").pop()!));
          return stagedVersion && installedVersion && Bun.semver.order(stagedVersion, installedVersion) <= 0;
        });
        if (applied) return [[dir, "staged version already installed"]];
        return ageDays(dir) > RETAIN_DAYS.updaters ? [[dir, `${Math.floor(ageDays(dir))} days old`]] : [];
      });
      const reasons = new Map(stale);
      const candidates = await rmCandidates([...reasons.keys()], (p) => reasons.get(p)!);
      return { candidates: candidates.filter((c) => c.bytes > 1e6) };
    },
  },
  {
    id: "app-caches",
    tier: 2,
    undo: "regenerates",
    signal: `cache files older than ${RETAIN_DAYS.appCaches} days, owning app not running`,
    scan: async () => {
      const running = await runningBundleIds();
      const dirs = children(join(HOME, "Library/Caches")).filter(
        (p) => isDir(p) && !/\.ShipIt$|-updater$|\/Homebrew$/.test(p) && !running.has(p.split("/").pop()!),
      );
      const sizes = await allocated(dirs);
      const big = dirs.filter((d) => (sizes.get(d) ?? 0) > 100e6);
      const candidates = await Promise.all(
        big.map(async (dir): Promise<Candidate> => {
          const old = await run(["find", dir, "-type", "f", "-mtime", `+${RETAIN_DAYS.appCaches}`, "-exec", "stat", "-f", "%b", "{}", "+"]);
          const bytes = sum(old.split("\n").filter(Boolean).map((b) => Number(b) * 512));
          return { target: dir, bytes, why: `${gb(sizes.get(dir) ?? 0)} folder`, action: ["find", dir, "-type", "f", "-mtime", `+${RETAIN_DAYS.appCaches}`, "-delete"] };
        }),
      );
      return { candidates: candidates.filter((c) => c.bytes > 1e6) };
    },
  },
  {
    id: "build-output",
    tier: 2,
    undo: "reinstall",
    signal: `node_modules, .next, .turbo in linked worktrees idle for ${RETAIN_DAYS.buildOutput} days`,
    scan: async () => {
      const idle = (
        await mapLimit(await linkedWorktrees(), 8, async (wt) => ((await lastActivityDays(wt)) > RETAIN_DAYS.buildOutput ? wt : undefined))
      ).filter((wt) => wt !== undefined);
      const dirs = (
        await mapLimit(idle, 8, async (wt) =>
          (await run(["find", wt.path, "-type", "d", "(", "-name", "node_modules", "-o", "-name", ".next", "-o", "-name", ".turbo", ")", "-prune"]))
            .split("\n")
            .filter(Boolean),
        )
      ).flat();
      return { candidates: await rmCandidates(dirs, () => "worktree idle") };
    },
  },
  {
    id: "git-worktrees",
    tier: 3,
    undo: "lost",
    signal: `PR merged or closed (or branch merged into origin default), clean, nothing unpushed, idle ${RETAIN_DAYS.worktrees} days`,
    scan: async () => {
      const prs = await prStates();
      const results = await mapLimit(await linkedWorktrees(), 8, async (wt) => {
        const defaultRef = (await run(["git", "-C", wt.repo, "symbolic-ref", "refs/remotes/origin/HEAD"])).replace("refs/remotes/", "");
        const pr = wt.branch ? prs.get(wt.repo)?.get(wt.branch) : undefined;
        const ancestor = defaultRef
          ? (await $`git -C ${wt.path} merge-base --is-ancestor HEAD ${defaultRef}`.nothrow().quiet()).exitCode === 0
          : false;
        const merged = pr === "MERGED" || pr === "CLOSED" || ancestor;
        const dirty = (await run(["git", "--no-optional-locks", "-C", wt.path, "status", "--porcelain"])).split("\n").filter(Boolean).length;
        const unpushed = Number(await run(["git", "-C", wt.path, "rev-list", "--count", "HEAD", "--not", "--remotes"]));
        const idle = await lastActivityDays(wt);
        const blockers = [
          !merged && `PR ${pr ?? "none"}, not merged`,
          dirty > 0 && `${dirty} uncommitted`,
          unpushed > 0 && `${unpushed} unpushed`,
          idle <= RETAIN_DAYS.worktrees && `active ${Math.floor(idle)}d ago`,
        ].filter((b): b is string => typeof b === "string");
        return { wt, blockers, why: `PR ${pr ?? "none"}, idle ${Math.floor(idle)}d` };
      });
      const sizes = await allocated(results.map((r) => r.wt.path));
      const toCandidate = (r: (typeof results)[number]): Candidate => ({
        target: r.wt.path,
        bytes: sizes.get(r.wt.path) ?? 0,
        why: r.blockers.length ? r.blockers.join(", ") : r.why,
        action: ["git", "-C", r.wt.repo, "worktree", "remove", r.wt.path],
      });
      return {
        candidates: results.filter((r) => r.blockers.length === 0).map(toCandidate),
        blocked: results.filter((r) => r.blockers.length > 0).map(toCandidate),
      };
    },
  },
  {
    id: "orphan-worktree-dirs",
    tier: 3,
    undo: "lost",
    signal: "folder in a worktree root that no repo lists as a worktree",
    scan: async () => {
      const known = new Set((await worktrees()).map((wt) => wt.path));
      const roots = [
        join(HOME, "development/worktrees"),
        join(HOME, ".cursor/worktrees"),
        ...children(join(HOME, ".t3/worktrees")),
        ...(await repos()).map((r) => join(r, "worktrees")),
      ];
      // Tools nest worktrees under container folders (~/.cursor/worktrees/<task>/<repo>), so descend into those.
      const orphansUnder = (dir: string): string[] =>
        children(dir)
          .filter((p) => isDir(p) && !known.has(p))
          .flatMap((p) => ([...known].some((k) => k.startsWith(`${p}/`)) ? orphansUnder(p) : [p]));
      const orphans = roots.flatMap(orphansUnder);
      return {
        candidates: await rmCandidates(orphans, (p) =>
          isDir(join(p, ".git")) ? "standalone clone, check for unpushed work" : "no repo lists it as a worktree",
        ),
      };
    },
  },
  {
    id: "t3-scratch",
    tier: 3,
    undo: "lost",
    signal: `scratch folder untouched for ${RETAIN_DAYS.t3Scratch} days`,
    scan: async () => {
      const stale = children(join(HOME, ".t3/scratch")).filter((p) => isDir(p) && ageDays(p) > RETAIN_DAYS.t3Scratch);
      return { candidates: await rmCandidates(stale, (p) => `${Math.floor(ageDays(p))} days old`) };
    },
  },
  {
    id: "app-state-files",
    tier: 3,
    undo: "lost",
    signal: `superseded or backup state file untouched for ${RETAIN_DAYS.stateFiles} days`,
    scan: async () => {
      const cursorBackup = join(HOME, "Library/Application Support/Cursor/User/globalStorage/state.vscdb.backup");
      const t3Old = join(HOME, ".t3/userdata/state.sqlite");
      const t3New = join(HOME, ".t3/userdata/statev2.sqlite");
      const claudeVm = join(HOME, "Library/Application Support/Claude/vm_bundles");
      const picks = [
        existsSync(cursorBackup) && ageDays(cursorBackup) > RETAIN_DAYS.stateFiles && ([cursorBackup, "Cursor backup copy, quit Cursor first"] as const),
        existsSync(t3Old) && existsSync(t3New) && ageDays(t3Old) > RETAIN_DAYS.stateFiles && ([t3Old, "statev2.sqlite is the live file, confirm with T3"] as const),
        existsSync(claudeVm) && ageDays(claudeVm) > RETAIN_DAYS.stateFiles && ([claudeVm, "Claude desktop VM image, re-downloaded on next use"] as const),
      ].filter((p) => p !== false);
      const reasons = new Map(picks);
      return { candidates: await rmCandidates([...reasons.keys()], (p) => reasons.get(p)!) };
    },
  },
];

// ---------- report ----------

const startedAt = new Date().toISOString();
const free0 = await freeBytes();
const results: { rule: Rule; scan: Scan; predicted: number; seconds: number }[] = [];
for (const rule of rules) {
  const t = performance.now();
  const scan = await rule.scan().catch((e: unknown): Scan => {
    console.error(`${rule.id}: scan failed: ${e instanceof Error ? e.message : String(e)}`);
    return { candidates: [] };
  });
  results.push({ rule, scan, predicted: sum(scan.candidates.map((c) => c.bytes)), seconds: (performance.now() - t) / 1000 });
}

console.log(`disk-cleanup ${flags.apply ? "apply" : "report"}  ${startedAt}  container free ${gb(free0)}`);
console.log(`retention days: ${Object.entries(RETAIN_DAYS).map(([k, v]) => `${k}=${v}`).join(" ")}\n`);
console.log("tier  rule                   undo         items  predicted");
for (const { rule, scan, predicted } of results) {
  const bound = scan.candidates.some((c) => c.upperBound) ? " (max)" : "";
  console.log(
    `${String(rule.tier).padEnd(6)}${rule.id.padEnd(23)}${rule.undo.padEnd(13)}${String(scan.candidates.length).padStart(5)}  ${gb(predicted)}${bound}`,
  );
}
for (const tier of [1, 2, 3] as const) {
  console.log(`tier ${tier} total: ${gb(sum(results.filter((r) => r.rule.tier === tier).map((r) => r.predicted)))}`);
}
for (const { rule, scan } of results) {
  if (scan.candidates.length === 0 && !scan.blocked?.length) continue;
  console.log(`\n[${rule.id}] ${rule.signal}`);
  for (const c of [...scan.candidates].sort((a, b) => b.bytes - a.bytes).slice(0, 8)) {
    console.log(`  ${gb(c.bytes).padStart(9)}  ${c.target.replace(HOME, "~")}  (${c.why})`);
  }
  if (scan.candidates.length > 8) console.log(`  ... ${scan.candidates.length - 8} more in the JSON report`);
  if (scan.blocked?.length) {
    const reasons = new Map<string, number>();
    for (const b of scan.blocked) for (const r of b.why.split(", ")) reasons.set(r.replace(/\d+/g, "N"), (reasons.get(r.replace(/\d+/g, "N")) ?? 0) + 1);
    console.log(`  blocked: ${scan.blocked.length} (${gb(sum(scan.blocked.map((b) => b.bytes)))}): ${[...reasons].map(([r, n]) => `${n}x ${r}`).join("; ")}`);
  }
}

mkdirSync(dirname(flags.out), { recursive: true });
writeFileSync(
  flags.out,
  JSON.stringify(
    { startedAt, freeBytes: free0, retainDays: RETAIN_DAYS, rules: results.map(({ rule, scan, predicted, seconds }) => ({ id: rule.id, tier: rule.tier, undo: rule.undo, signal: rule.signal, predicted, seconds, ...scan })) },
    null,
    2,
  ),
);
console.log(`\nfull report: ${flags.out}`);

// ---------- apply ----------

if (flags.apply) {
  const named = flags.rules?.split(",");
  // Tier 3 is never applied, even when named.
  const selected = results.filter((r) => r.rule.tier !== 3 && (named ? named.includes(r.rule.id) : r.rule.tier === 1));
  const floor = Number(flags["floor-gb"]) * 1e9;
  mkdirSync(dirname(flags.log), { recursive: true });
  const log = (entry: Record<string, unknown>) => appendFileSync(flags.log, `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`);

  if (!named && free0 >= floor) {
    log({ skipped: "above floor", freeBytes: free0, floorBytes: floor });
    console.log(`\nfree ${gb(free0)} is above the ${gb(floor)} floor, nothing applied`);
  } else {
    for (const { rule, scan, predicted } of selected) {
      const before = await freeBytes();
      for (const c of scan.candidates) {
        if (c.action[0] === "rm" && !c.action[2]?.startsWith(`${HOME}/`)) throw new Error(`refusing rm outside home: ${c.action[2]}`);
        await $`${c.action}`.cwd(c.cwd ?? HOME).nothrow().quiet();
      }
      const after = await freeBytes();
      log({ rule: rule.id, tier: rule.tier, items: scan.candidates.length, predicted, actual: after - before, freeAfter: after });
      console.log(`${rule.id}: predicted ${gb(predicted)}, actual ${gb(after - before)}`);
    }
  }
}
