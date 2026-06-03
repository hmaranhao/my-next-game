/**
 * Gera catálogo reduzido para Cloudflare Workers (~8k jogos, cabe em memória).
 * Upload para R2: wrangler r2 object put my-next-game-data/games.cloud.json --file=data/games.cloud.json
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const MAX_GAMES = Number.parseInt(process.env.CLOUD_GAME_LIMIT ?? "8000", 10);

function popularity(game) {
  const raw = game.raw ?? {};
  return Number(raw.recommendations ?? 0) + Number(raw.positive ?? 0);
}

const gamesPath = path.join(root, "data/games.normalized.json");
const pairsPath = path.join(root, "data/co-occurrence.pairs.json");

if (!fs.existsSync(gamesPath)) {
  console.error("Missing data/games.normalized.json — run npm run data:download first");
  process.exit(1);
}

const games = JSON.parse(fs.readFileSync(gamesPath, "utf-8"));
const sorted = [...games].sort((a, b) => popularity(b) - popularity(a));
const trimmed = sorted.slice(0, MAX_GAMES);
const ids = new Set(trimmed.map((g) => g.id));

let pairs = [];
if (fs.existsSync(pairsPath)) {
  const allPairs = JSON.parse(fs.readFileSync(pairsPath, "utf-8"));
  pairs = allPairs.filter(
    (p) => ids.has(p.sourceGameId) && ids.has(p.targetGameId),
  );
}

const outGames = path.join(root, "data/games.cloud.json");
const outPairs = path.join(root, "data/co-occurrence.cloud.json");
fs.writeFileSync(outGames, JSON.stringify(trimmed));
fs.writeFileSync(outPairs, JSON.stringify(pairs));

console.log(`Wrote ${trimmed.length} games -> data/games.cloud.json`);
console.log(`Wrote ${pairs.length} pairs -> data/co-occurrence.cloud.json`);
console.log(
  "Upload: wrangler r2 object put my-next-game-data/games.cloud.json --file=data/games.cloud.json",
);
