/** Normalized game record from Kaggle video-games dataset */
export type NormalizedGame = {
  id: string;
  name: string;
  genre: string | null;
  platform: string | null;
  year: number | null;
  rating: number | null;
  tags: string[];
  price: number | null;
  publisher: string | null;
  raw: Record<string, string | number | null>;
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
