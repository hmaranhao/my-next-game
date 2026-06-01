import type { CoOccurrencePair, GamesDatasetManifest, NormalizedGame } from "@/types/game";
import sampleGames from "../../data/samples/games.sample.json";
import samplePairs from "../../data/samples/co-occurrence.sample.json";

const GAMES_PATH = "data/games.normalized.json";
const PAIRS_PATH = "data/co-occurrence.pairs.json";

export async function loadGamesDataset(): Promise<{
  games: NormalizedGame[];
  pairs: CoOccurrencePair[];
  manifest: GamesDatasetManifest | null;
}> {
  if (process.env.USE_SAMPLE_GAME_DATA === "true") {
    return {
      games: sampleGames as NormalizedGame[],
      pairs: samplePairs as CoOccurrencePair[],
      manifest: null,
    };
  }

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();
    const gamesRaw = await fs.readFile(path.join(root, GAMES_PATH), "utf-8");
    const pairsRaw = await fs.readFile(path.join(root, PAIRS_PATH), "utf-8");
    let manifest: GamesDatasetManifest | null = null;
    try {
      const manifestRaw = await fs.readFile(path.join(root, "data/manifest.json"), "utf-8");
      manifest = JSON.parse(manifestRaw) as GamesDatasetManifest;
    } catch {
      manifest = null;
    }
    return {
      games: JSON.parse(gamesRaw) as NormalizedGame[],
      pairs: JSON.parse(pairsRaw) as CoOccurrencePair[],
      manifest,
    };
  } catch {
    return {
      games: sampleGames as NormalizedGame[],
      pairs: samplePairs as CoOccurrencePair[],
      manifest: null,
    };
  }
}
