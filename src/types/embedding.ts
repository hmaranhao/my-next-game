/** Fixed embedding size — must match Prisma vector(128) */
export const EMBEDDING_DIMENSION = 128;

/**
 * Vector layout (128 dimensions, shared profile/game index space):
 * [0–31]   genres (multi-hot / preference weights)
 * [32–47]  platforms
 * [48–63]  tags
 * [64–71]  publishers
 * [72–79]  continuous: rating, year, price, playtime-or-age, sourceSteam, reserved×3
 * [80–127] reserved (zeros)
 */
export const EMBEDDING_LAYOUT = {
  genreStart: 0,
  genreSize: 32,
  platformStart: 32,
  platformSize: 16,
  tagStart: 48,
  tagSize: 16,
  publisherStart: 64,
  publisherSize: 8,
  continuousStart: 72,
  continuousSize: 8,
} as const;

export type DistanceMetric = "cosine" | "l2";

export type EmbeddingContextMeta = {
  dimension: number;
  genres: string[];
  platforms: string[];
  tags: string[];
  publishers: string[];
  ratingMin: number;
  ratingMax: number;
  yearMin: number;
  yearMax: number;
  priceMin: number;
  priceMax: number;
};

export type ScoredCandidate = {
  gameId: string;
  game: import("@/types/game").NormalizedGame;
  /** Concat profile+game (pgvector storage) */
  vector: Float32Array;
  /** Game-only slice for TF.js inference */
  gameVector: Float32Array;
  score: number;
  distance: number;
};

export type CandidateSearchResult = {
  sessionId: string;
  metric: DistanceMetric;
  queryVector: number[];
  candidates: Array<{
    rank: number;
    gameId: string;
    name: string;
    genre: string | null;
    platform: string | null;
    rating: number | null;
    score: number;
    distance: number;
    gameVector: number[];
    metadata: import("@/types/game").NormalizedGame;
  }>;
  elapsedMs: number;
};

export type ModelRecommendation = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  matchPercent: number;
  explanationKey: string;
  explanationValues: Record<string, string | number>;
};
