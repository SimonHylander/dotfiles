// Usage: node score.mjs <round> <judge> <work dir>
// Reads <work>/judge/round-N/scores-<judge>.json and the round's mapping, prints each product's
// mean per category, what still blocks the target, and the judge's flat streak. Records the
// round in <work>/council.json, the source for the PR's council table.
//
// The target: ours scores above every reference in every category, and at least 9 in each.
// A round is flat when ours' total is not above the judge's best earlier total.
import fs from "node:fs";
import path from "node:path";

const [round, judge, work] = process.argv.slice(2);
const read = (file) => JSON.parse(fs.readFileSync(path.join(work, file), "utf8"));
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (values) => values.reduce((a, b) => a + b, 0);
const total = (row) => sum(Object.values(row).filter((v) => v !== null));

// packet.mjs records the round's categories beside its mapping.
const { products: mapping, categories } = read(`mappings/round-${round}.json`);
const { images } = read(`judge/round-${round}/scores-${judge}.json`);

const table = {};
for (const [letter, product] of Object.entries(mapping)) {
  table[product] = {};
  for (const category of categories) {
    const values = Object.entries(images)
      .filter(([name, image]) => name.startsWith(`${letter}-`) && image.scores[category] != null)
      .map(([, image]) => image.scores[category]);
    table[product][category] = values.length === 0 ? null : round2(sum(values) / values.length);
  }
}

console.log(" ".repeat(12) + categories.map((c) => c.slice(0, 6).padStart(8)).join("") + "total".padStart(8));
for (const [product, row] of Object.entries(table)) {
  const cells = categories.map((c) => String(row[c] ?? "-").padStart(8)).join("");
  console.log(product.padEnd(12) + cells + String(round2(total(row))).padStart(8));
}

const ours = table.ours;
const blocking = categories.filter(
  (c) =>
    ours[c] === null ||
    ours[c] < 9 ||
    Object.entries(table).some(([product, row]) => product !== "ours" && row[c] !== null && ours[c] <= row[c]),
);
console.log("blocking:", blocking.join(", ") || "none, this judge passes");

const councilPath = path.join(work, "council.json");
const council = fs.existsSync(councilPath) ? JSON.parse(fs.readFileSync(councilPath, "utf8")) : {};
council[judge] = { ...council[judge], [round]: table };
fs.writeFileSync(councilPath, JSON.stringify(council, null, 1));

const totals = Object.entries(council[judge])
  .map(([r, t]) => [Number(r), total(t.ours)])
  .sort(([a], [b]) => a - b);
let best = -Infinity;
let flat = 0;
for (const [, t] of totals) {
  flat = t > best ? 0 : flat + 1;
  best = Math.max(best, t);
}
const current = totals.find(([r]) => r === Number(round))[1];
console.log(`total ${round2(current)}, best ${round2(best)}, flat rounds in a row: ${flat}${flat >= 3 ? " (stop)" : ""}`);
