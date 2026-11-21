// Usage: node packet.mjs <surface.json> <round> <work dir>
// Builds round N's blind judge packet at <work>/judge/round-N/packet: one folder per product,
// lettered in a fresh random order, each image named <letter>-<viewport>-<view>-<theme>.png,
// with RUBRIC.md and DESIGN.md. The letter-to-product mapping and the round's categories go to
// <work>/mappings/round-N.json, outside the packet, so a judge never sees them.
import { execFileSync } from "node:child_process";
import { randomInt } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

// Every surface is scored on these. A surface config's `categories` adds its own.
const coreCategories = {
  hierarchy: "what matters most is seen first; the primary action and the current state are obvious.",
  typography: "scale, weight and rhythm of type; legibility; numerals.",
  spacing: "alignment and consistency: rhythm, consistent sizes, radii and treatments.",
  color: "purposeful color, readable contrast in both light and dark where shown.",
  iconography: "icons are clear, consistent, and used where they help.",
  phone: "one hand on a phone: target size, contrast, thumb reach, how few taps.",
};

const [configPath, round, work] = process.argv.slice(2);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const categories = { ...coreCategories, ...config.categories };

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
// .scratch lives in the main checkout, also when this runs in a worktree.
const scratch = path.join(path.dirname(git("rev-parse", "--path-format=absolute", "--git-common-dir")), ".scratch");
const worktree = git("rev-parse", "--show-toplevel");

const oursDir = path.join(scratch, "design-review", config.surface, `round-${round}`);
const refsDir = path.join(scratch, "design-references", config.surface);
const products = { ours: {} };
for (const viewport of ["desktop", "phone"]) {
  for (const theme of ["light", "dark"]) {
    for (const [state, view] of Object.entries(config.views)) {
      products.ours[`${viewport}-${view}-${theme}`] = path.join(oursDir, `${viewport}-${theme}-${state}.png`);
    }
  }
}
for (const [name, shots] of Object.entries(config.references)) {
  products[name] = Object.fromEntries(Object.entries(shots).map(([shot, file]) => [shot, path.join(refsDir, file)]));
}
for (const src of Object.values(products).flatMap(Object.values)) {
  if (!fs.existsSync(src)) throw new Error(`missing ${src}`);
}

const names = Object.keys(products);
for (let i = names.length - 1; i > 0; i--) {
  const j = randomInt(i + 1);
  [names[i], names[j]] = [names[j], names[i]];
}
const mapping = Object.fromEntries(names.map((name, i) => [String.fromCharCode(65 + i), name]));

const packet = path.join(work, "judge", `round-${round}`, "packet");
fs.rmSync(packet, { recursive: true, force: true });
for (const [letter, name] of Object.entries(mapping)) {
  fs.mkdirSync(path.join(packet, letter), { recursive: true });
  for (const [shot, src] of Object.entries(products[name])) {
    fs.copyFileSync(src, path.join(packet, letter, `${letter}-${shot}.png`));
  }
}
fs.copyFileSync(path.join(worktree, "DESIGN.md"), path.join(packet, "DESIGN.md"));

const fills = {
  letters: Object.keys(mapping).join(", "),
  intro: config.rubricIntro,
  categories: Object.entries(categories)
    .map(([key, text], i) => `${i + 1}. **${key}**: ${text}`)
    .join("\n"),
  example: `A-${Object.keys(products.ours)[0]}.png`,
  scores: JSON.stringify(Object.fromEntries(Object.keys(categories).map((key) => [key, 0]))),
};
const template = fs.readFileSync(path.join(import.meta.dirname, "..", "RUBRIC.md"), "utf8");
fs.writeFileSync(
  path.join(packet, "RUBRIC.md"),
  Object.entries(fills).reduce((text, [key, value]) => text.replaceAll(`{{${key}}}`, value), template),
);

fs.mkdirSync(path.join(work, "mappings"), { recursive: true });
fs.writeFileSync(
  path.join(work, "mappings", `round-${round}.json`),
  JSON.stringify({ products: mapping, categories: Object.keys(categories) }),
);
console.log(packet);
