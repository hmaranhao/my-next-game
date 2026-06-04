import type { ProfileGameEntry } from "@/types/profile";

/** Games below this playtime are treated as abandoned experiments. */
export const ABANDONED_PLAYTIME_MINUTES = 120;
export const ABANDONED_WEIGHT_FACTOR = 0.35;

/** Min playtime for "last meaningful game" recommendation anchor (default 10h). */
export const MEANINGFUL_ANCHOR_PLAYTIME_MINUTES = 600;

/** Max library entries used to build the profile vector. */
export const LIBRARY_ENCODE_LIMIT = 50;
/** Max library games sent to TF.js user vector. */
export const TF_LIBRARY_VECTOR_LIMIT = 20;

const MS_PER_DAY = 86_400_000;

/** Recency boost — recent play counts more in taste modeling. */
export function recencyMultiplier(lastPlayedAt: string | null): number {
  if (!lastPlayedAt) return 1;
  const days = (Date.now() - new Date(lastPlayedAt).getTime()) / MS_PER_DAY;
  if (days <= 30) return 1.25;
  if (days <= 90) return 1.1;
  if (days <= 365) return 1;
  return 0.85;
}

/** Playtime + recency weight for a library entry. */
export function entryPlaytimeWeight(entry: ProfileGameEntry): number {
  const minutes = Math.max(0, entry.playtimeMinutes);
  let weight = Math.log10(minutes + 10);

  if (minutes > 0 && minutes < ABANDONED_PLAYTIME_MINUTES) {
    weight *= ABANDONED_WEIGHT_FACTOR;
  }

  weight *= recencyMultiplier(entry.lastPlayedAt);

  // Manual favorites without playtime still contribute equally
  if (minutes === 0) {
    weight = 1;
  }

  return Math.max(0.1, weight);
}

export function weightedAverageVectors(
  vectors: number[][],
  weights: number[],
): number[] | null {
  if (!vectors.length || vectors.length !== weights.length) return null;

  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  let total = 0;

  for (let v = 0; v < vectors.length; v++) {
    const w = weights[v];
    if (w <= 0) continue;
    total += w;
    for (let i = 0; i < dim; i++) {
      out[i] += vectors[v][i] * w;
    }
  }

  if (total <= 0) return null;
  return out.map((x) => x / total);
}
