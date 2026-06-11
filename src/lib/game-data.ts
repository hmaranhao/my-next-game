import type { CoOccurrencePair, GamesDatasetManifest, NormalizedGame } from "@/types/game";
import sampleGames from "../../data/samples/games.sample.json";
import samplePairs from "../../data/samples/co-occurrence.sample.json";

const GAMES_PATH = "data/games.normalized.json";
const CURATED_GAMES_PATH = "data/games.curated.json";
const CLOUD_GAMES_PATH = "data/games.cloud.json";
const PAIRS_PATH = "data/co-occurrence.pairs.json";
const CURATED_PAIRS_PATH = "data/co-occurrence.curated.json";
const CLOUD_PAIRS_PATH = "data/co-occurrence.cloud.json";
const CLOUD_GAMES_KEY = "games.cloud.json";
const CLOUD_PAIRS_KEY = "co-occurrence.cloud.json";

type GameDataBucket = {
  get: (key: string) => Promise<{ text: () => Promise<string> } | null>;
};

type DatasetCache = {
  games: NormalizedGame[];
  pairs: CoOccurrencePair[];
  manifest: GamesDatasetManifest | null;
};

const globalCache = globalThis as typeof globalThis & {
  __myNextGameDataset?: DatasetCache;
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

async function readJsonIfExists(
  fs: typeof import("node:fs/promises"),
  filePath: string,
): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

/** Local dev: cloud/curated payloads align with pgvector INDEX_SOURCE=curated. */
async function loadFromFilesystem(): Promise<DatasetCache | null> {
  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const root = process.cwd();

    const games =
      ((await readJsonIfExists(fs, path.join(root, CLOUD_GAMES_PATH))) as
        | NormalizedGame[]
        | null) ??
      ((await readJsonIfExists(fs, path.join(root, CURATED_GAMES_PATH))) as
        | NormalizedGame[]
        | null) ??
      ((await readJsonIfExists(fs, path.join(root, GAMES_PATH))) as
        | NormalizedGame[]
        | null);

    if (!games?.length) return null;

    const pairs =
      ((await readJsonIfExists(fs, path.join(root, CLOUD_PAIRS_PATH))) as
        | CoOccurrencePair[]
        | null) ??
      ((await readJsonIfExists(fs, path.join(root, CURATED_PAIRS_PATH))) as
        | CoOccurrencePair[]
        | null) ??
      ((await readJsonIfExists(fs, path.join(root, PAIRS_PATH))) as
        | CoOccurrencePair[]
        | null) ??
      (samplePairs as CoOccurrencePair[]);

    let manifest: GamesDatasetManifest | null = null;
    try {
      const manifestRaw = await fs.readFile(path.join(root, "data/manifest.json"), "utf-8");
      manifest = JSON.parse(manifestRaw) as GamesDatasetManifest;
    } catch {
      manifest = null;
    }

    return { games, pairs, manifest };
  } catch {
    return null;
  }
}

export async function loadGamesDataset(): Promise<DatasetCache> {
  if (globalCache.__myNextGameDataset) {
    return globalCache.__myNextGameDataset;
  }

  let result: DatasetCache;

  if (process.env.USE_SAMPLE_GAME_DATA === "true") {
    result = {
      games: sampleGames as NormalizedGame[],
      pairs: samplePairs as CoOccurrencePair[],
      manifest: null,
    };
  } else {
    const fromR2 = await loadFromR2();
    if (fromR2) {
      result = { ...fromR2, manifest: null };
    } else {
      const fromDisk = await loadFromFilesystem();
      result =
        fromDisk ?? {
          games: sampleGames as NormalizedGame[],
          pairs: samplePairs as CoOccurrencePair[],
          manifest: null,
        };
    }
  }

  globalCache.__myNextGameDataset = result;
  return result;
}
