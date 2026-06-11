/**
 * Build curated catalog: 1M+ owners, 200k+ social proof (or publisher-backed), no Casual.
 *
 * Usage: npm run data:curated
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCatalogEligible } from "./catalog-eligibility.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const gamesPath = path.join(root, "data/games.normalized.json");
const pairsPath = path.join(root, "data/co-occurrence.pairs.json");

if (!fs.existsSync(gamesPath)) {
  console.error("Missing data/games.normalized.json — run npm run data:download first");
  process.exit(1);
}

const allGames = JSON.parse(fs.readFileSync(gamesPath, "utf-8"));
const curated = allGames.filter(isCatalogEligible);
const ids = new Set(curated.map((g) => g.id));

let pairs = [];
if (fs.existsSync(pairsPath)) {
  const allPairs = JSON.parse(fs.readFileSync(pairsPath, "utf-8"));
  pairs = allPairs.filter(
    (p) => ids.has(p.sourceGameId) && ids.has(p.targetGameId),
  );
}

const outGames = path.join(root, "data/games.curated.json");
const outPairs = path.join(root, "data/co-occurrence.curated.json");
fs.writeFileSync(outGames, JSON.stringify(curated));
fs.writeFileSync(outPairs, JSON.stringify(pairs));

console.log(`Curated catalog: ${curated.length} / ${allGames.length} games`);
console.log(`Co-occurrence pairs: ${pairs.length}`);
console.log(`Wrote ${outGames}`);
console.log(`Wrote ${outPairs}`);

if (curated.length > 0) {
  const sample = curated.slice(0, 3).map((g) => g.name);
  console.log(`Sample: ${sample.join(", ")}…`);
}
