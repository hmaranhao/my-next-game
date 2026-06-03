/** Normalized game record from Kaggle Steam games dataset */
export type NormalizedGame = {
  /** Stable id — Steam AppID as string */
  id: string;
  steamAppId: number | null;
  name: string;
  genre: string | null;
  platform: string | null;
  year: number | null;
  rating: number | null;
  tags: string[];
  price: number | null;
  publisher: string | null;
  /** 0–1 — higher = more owners / positive reviews */
  popularityScore?: number | null;
  positiveReviews?: number | null;
  recommendations?: number | null;
  estimatedOwners?: string | null;
  estimatedOwnersMid?: number | null;
  shortDescription?: string | null;
  headerImage?: string | null;
  screenshots?: string[];
  developers?: string[];
  raw: Record<string, string | number | null | string[]>;
};

/** Collaborative pair for TF.js training: liked X → also liked Y */
export type CoOccurrencePair = {
  sourceGameId: string;
  targetGameId: string;
  weight: number;
};

export type GamesDatasetManifest = {
  version: string;
  generatedAt: string;
  source: string;
  gameCount: number;
  pairCount: number;
  gamesPath: string;
  pairsPath: string;
};

export function steamStoreUrl(game: Pick<NormalizedGame, "steamAppId" | "id">): string {
  const id = game.steamAppId ?? Number.parseInt(game.id, 10);
  return `https://store.steampowered.com/app/${id}`;
}
