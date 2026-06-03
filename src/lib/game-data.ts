import type { CoOccurrencePair, GamesDatasetManifest, NormalizedGame } from "@/types/game";
import sampleGames from "../../data/samples/games.sample.json";
import samplePairs from "../../data/samples/co-occurrence.sample.json";

const GAMES_PATH = "data/games.normalized.json";
const PAIRS_PATH = "data/co-occurrence.pairs.json";
const CLOUD_GAMES_KEY = "games.cloud.json";
const CLOUD_PAIRS_KEY = "co-occurrence.cloud.json";

type GameDataBucket = {
  get: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

async function loadFromR2(): Promise<{
  games: NormalizedGame[];
  pairs: CoOccurrencePair[];
} | null> {
  try {
    const { getCloudflareContext } = await import("@opennextjs/cloudflare");
    const { env } = getCloudflareContext();
    const bucket = (env as { GAME_DATA?: GameDataBucket }).GAME_DATA;
    if (!bucket) return null;

    const [gamesObj, pairsObj] = await Promise.all([
      bucket.get(CLOUD_GAMES_KEY),
      bucket.get(CLOUD_PAIRS_KEY),
    ]);
    if (!gamesObj) return null;

    const games = JSON.parse(await gamesObj.text()) as NormalizedGame[];
    const pairs = pairsObj
      ? (JSON.parse(await pairsObj.text()) as CoOccurrencePair[])
      : (samplePairs as CoOccurrencePair[]);

    return { games, pairs };
  } catch {
    return null;
  }
}

async function loadFromFilesystem(): Promise<{
  games: NormalizedGame[];
  pairs: CoOccurrencePair[];
  manifest: GamesDatasetManifest | null;
} | null> {
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
    return null;
  }
}

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

  const fromR2 = await loadFromR2();
  if (fromR2) {
    return { ...fromR2, manifest: null };
  }

  const fromDisk = await loadFromFilesystem();
  if (fromDisk) {
    return fromDisk;
  }

  return {
    games: sampleGames as NormalizedGame[],
    pairs: samplePairs as CoOccurrencePair[],
    manifest: null,
  };
}
