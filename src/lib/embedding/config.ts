import { EMBEDDING_DIMENSION, EMBEDDING_LAYOUT as L } from "@/types/embedding";

/** One-hot / multi-hot strength when encoding vectors */
export const ENCODE_WEIGHTS = {
  profileGenre: 1,
  /** Tags inferred from library + genres mapped to tag slots */
  profileTag: 1.6,
  gameGenre: 0.85,
  gameTag: 2,
  gamePlatform: 1,
  gamePublisher: 0.75,
} as const;

/** Per-dimension multiplier for similarity (tags dominate matching). */
export const SEGMENT_SIMILARITY_WEIGHTS = {
  genre: 0.9,
  platform: 0.55,
  tags: 2.75,
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

/** How much popularity (reviews / owners) affects vector ranking 0–1. */
export const POPULARITY_BLEND = 0.35;

/** Candidate pool size after vector ranking (default 1000). */
export function getCandidateTopK(): number {
  const raw = Number.parseInt(process.env.VECTOR_TOP_K ?? "1000", 10);
  if (!Number.isFinite(raw) || raw < 1) return 1000;
  return Math.min(raw, 5000);
}

/** TF.js + escolha final só entre os N melhores do ranking vetorial (default 10). */
export function getFinalPickTopN(): number {
  const raw = Number.parseInt(process.env.VECTOR_FINAL_PICK_TOP_N ?? "10", 10);
  const topK = getCandidateTopK();
  if (!Number.isFinite(raw) || raw < 1) return Math.min(10, topK);
  return Math.min(raw, topK);
}
