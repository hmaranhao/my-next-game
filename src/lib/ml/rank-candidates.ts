export type RankableCandidate = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  /** Raw vector similarity 0–1 */
  vectorScore: number;
  /** Rank score from API (vector + popularity blend) — use for display + hybrid */
  rankScore?: number;
  popularityScore?: number;
};

export type HybridScoredCandidate = RankableCandidate & {
  combinedScore: number;
  matchPercent: number;
};

/** TF.js refines among top-N; rank score already includes popularity. */
export const HYBRID_RANK_WEIGHT = 0.72;
export const HYBRID_TF_WEIGHT = 0.28;

export function minMaxNormalize(values: number[]): number[] {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

export function averageVectors(vectors: number[][]): number[] | null {
  if (!vectors.length) return null;
  const dim = vectors[0].length;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) out[i] += v[i];
  }
  return out.map((x) => x / vectors.length);
}

function rankInput(c: RankableCandidate): number {
  return c.rankScore ?? c.vectorScore;
}

/** Same formula for every candidate — keeps top-10 % in sync with final card. */
export function scoreAllHybrid(
  candidates: RankableCandidate[],
  tfScoresByGameId: Map<string, number>,
): HybridScoredCandidate[] {
  if (!candidates.length) return [];

  const tfRaw = candidates.map((c) => tfScoresByGameId.get(c.gameId) ?? 0);
  const tfNorm = minMaxNormalize(tfRaw);

  return candidates.map((c, i) => {
    const combined =
      HYBRID_RANK_WEIGHT * rankInput(c) + HYBRID_TF_WEIGHT * tfNorm[i];
    return {
      ...c,
      combinedScore: combined,
      matchPercent: Math.round(Math.min(100, Math.max(0, combined * 100))),
    };
  });
}

export function pickHybridRecommendation(
  candidates: RankableCandidate[],
  tfScoresByGameId: Map<string, number>,
): HybridScoredCandidate | null {
  const scored = scoreAllHybrid(candidates, tfScoresByGameId);
  if (!scored.length) return null;

  return scored.reduce((best, cur) =>
    cur.combinedScore > best.combinedScore ? cur : best,
  );
}
