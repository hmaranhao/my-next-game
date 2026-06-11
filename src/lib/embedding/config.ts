import { EMBEDDING_DIMENSION, EMBEDDING_LAYOUT as L } from "@/types/embedding";

/** One-hot / multi-hot strength when encoding vectors */
export const ENCODE_WEIGHTS = {
  profileGenre: 1.5,
  /** Gameplay tags (categories excluded upstream). */
  profileTag: 1.0,
  gameGenre: 1.5,
  gameTag: 0.9,
  gamePlatform: 1,
  gamePublisher: 0.75,
} as const;

/** Per-dimension multiplier for similarity (Steam genres dominate). */
export const SEGMENT_SIMILARITY_WEIGHTS = {
  genre: 2.5,
  platform: 0.55,
  tags: 1.1,
  publisher: 0.45,
  continuous: 0.75,
} as const;

let cachedDimensionWeights: Float32Array | null = null;

export function getDimensionWeights(): Float32Array {
  if (cachedDimensionWeights) return cachedDimensionWeights;

  const w = new Float32Array(EMBEDDING_DIMENSION).fill(1);
  const S = SEGMENT_SIMILARITY_WEIGHTS;

  for (let i = L.genreStart; i < L.genreStart + L.genreSize; i++) w[i] = S.genre;
  for (let i = L.platformStart; i < L.platformStart + L.platformSize; i++) {
    w[i] = S.platform;
  }
  for (let i = L.tagStart; i < L.tagStart + L.tagSize; i++) w[i] = S.tags;
  for (let i = L.publisherStart; i < L.publisherStart + L.publisherSize; i++) {
    w[i] = S.publisher;
  }
  for (let i = L.continuousStart; i < L.continuousStart + L.continuousSize; i++) {
    w[i] = S.continuous;
  }

  cachedDimensionWeights = w;
  return w;
}

/** How much popularity (reviews / owners) affects final rank 0–1. */
export function getPopularityBlend(): number {
  const raw = Number.parseFloat(process.env.POPULARITY_BLEND ?? "0.10");
  if (!Number.isFinite(raw)) return 0.10;
  return Math.min(0.45, Math.max(0, raw));
}

/** Taste overlap (tags/genres) vs vector similarity. */
export function getOverlapBlend(): number {
  const raw = Number.parseFloat(process.env.OVERLAP_BLEND ?? "0.26");
  if (!Number.isFinite(raw)) return 0.26;
  return Math.min(0.45, Math.max(0, raw));
}

/** Steam user rating contribution to rank. */
export function getQualityBlend(): number {
  const raw = Number.parseFloat(process.env.QUALITY_BLEND ?? "0.12");
  if (!Number.isFinite(raw)) return 0.12;
  return Math.min(0.2, Math.max(0, raw));
}

/** How much the last-played game steers recommendations (default 0.30). */
export function getLastPlayedBlend(): number {
  const raw = Number.parseFloat(process.env.LAST_PLAYED_BLEND ?? "0.30");
  if (!Number.isFinite(raw)) return 0.30;
  return Math.min(0.55, Math.max(0, raw));
}

/** Co-occurrence pairs from the user's library to a candidate. */
export function getCoOccurrenceBlend(): number {
  const raw = Number.parseFloat(process.env.CO_OCCURRENCE_BLEND ?? "0.20");
  if (!Number.isFinite(raw)) return 0.20;
  return Math.min(0.35, Math.max(0, raw));
}

/** Production tier (AAA/AA/Indie) match vs anchor game. */
export function getTierBlend(): number {
  const raw = Number.parseFloat(process.env.TIER_BLEND ?? "0.10");
  if (!Number.isFinite(raw)) return 0.10;
  return Math.min(0.25, Math.max(0, raw));
}

/** Same developer / publisher as anchor. */
export function getStudioBlend(): number {
  const raw = Number.parseFloat(process.env.STUDIO_BLEND ?? "0.08");
  if (!Number.isFinite(raw)) return 0.08;
  return Math.min(0.18, Math.max(0, raw));
}

/** @deprecated use getPopularityBlend() — kept for imports */
export const POPULARITY_BLEND = 0.28;

/** Candidate pool size after vector ranking (default 1000). */
export function getCandidateTopK(): number {
  const raw = Number.parseInt(process.env.VECTOR_TOP_K ?? "1000", 10);
  if (!Number.isFinite(raw) || raw < 1) return 1000;
  return Math.min(raw, 5000);
}

/** How many ranked candidates to persist in Postgres (Workers: keep low). */
export function getPersistTopN(): number {
  const raw = Number.parseInt(process.env.VECTOR_PERSIST_TOP_N ?? "25", 10);
  const topK = getCandidateTopK();
  if (!Number.isFinite(raw) || raw < 1) return Math.min(25, topK);
  return Math.min(raw, topK);
}

/** How many candidates the API returns to the client (with vectors). */
export function getApiResponseTopN(): number {
  return getFinalPickTopN();
}

/** TF.js + escolha final só entre os N melhores do ranking vetorial (default 30). */
export function getFinalPickTopN(): number {
  const raw = Number.parseInt(process.env.VECTOR_FINAL_PICK_TOP_N ?? "30", 10);
  const topK = getCandidateTopK();
  if (!Number.isFinite(raw) || raw < 1) return Math.min(30, topK);
  return Math.min(raw, topK);
}

export type VectorSearchBackend = "auto" | "pg" | "memory";

/** Where candidate ranking runs: pgvector KNN in Postgres or in-memory over JSON. */
export function getVectorSearchBackend(): VectorSearchBackend {
  const raw = (process.env.VECTOR_SEARCH_BACKEND ?? "auto").toLowerCase();
  if (raw === "pg" || raw === "memory" || raw === "auto") return raw;
  return "auto";
}
