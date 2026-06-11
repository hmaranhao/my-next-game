/**
 * Copies curated catalog to cloud payloads for R2.
 * Run data:curated first, then upload games.cloud.json to R2.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function slimForCloud(game) {
  return {
    ...game,
    screenshots: [],
    shortDescription: game.shortDescription
      ? String(game.shortDescription).slice(0, 280)
      : game.shortDescription,
  };
}

const curatedPath = path.join(root, "data/games.curated.json");
const curatedPairsPath = path.join(root, "data/co-occurrence.curated.json");

if (!fs.existsSync(curatedPath)) {
  console.error("Missing data/games.curated.json — run npm run data:curated first");
  process.exit(1);
}

const games = JSON.parse(fs.readFileSync(curatedPath, "utf-8")).map(slimForCloud);
const pairs = fs.existsSync(curatedPairsPath)
  ? JSON.parse(fs.readFileSync(curatedPairsPath, "utf-8"))
  : [];

const outGames = path.join(root, "data/games.cloud.json");
const outPairs = path.join(root, "data/co-occurrence.cloud.json");
fs.writeFileSync(outGames, JSON.stringify(games));
fs.writeFileSync(outPairs, JSON.stringify(pairs));

console.log(`Wrote ${games.length} games -> data/games.cloud.json`);
console.log(`Wrote ${pairs.length} pairs -> data/co-occurrence.cloud.json`);
console.log(
  "Upload: wrangler r2 object put my-next-game-data/games.cloud.json --file=data/games.cloud.json",
);
