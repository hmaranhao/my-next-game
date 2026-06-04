export type RankableCandidate = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  /** Raw vector similarity 0–1 */
  vectorScore: number;
  /** Rank score from API (vector + popularity + overlap) */
  rankScore?: number;
  popularityScore?: number;
};

export type HybridScoredCandidate = RankableCandidate & {
  combinedScore: number;
  matchPercent: number;
};

/** Vector ranking dominates; TF.js only refines among similar picks. */
export const HYBRID_RANK_WEIGHT = 0.9;
export const HYBRID_TF_WEIGHT = 0.1;

export const MATCH_PERCENT_FLOOR = 62;
export const MATCH_PERCENT_CEIL = 97;
const TOP3_MATCH_MIN = [88, 84, 80] as const;

/** Rank-first shortlist size for TF.js refinement. */
const HYBRID_SHORTLIST_SIZE = 6;
const RANK_TIE_EPSILON = 0.025;

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

/**
 * Map raw ranking scores to user-facing match % (top of pool ≈ 85–97%).
 * Absolute cosine on sparse 128-d vectors is often 0.10–0.25 even for good fits.
 */
export function calibrateToMatchPercents(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];

  const order = values
    .map((v, i) => ({ v, i }))
    .sort((a, b) => b.v - a.v);

  const out = new Array<number>(n);
  order.forEach(({ i }, rank) => {
    const relative = n <= 1 ? 1 : 1 - rank / (n - 1);
    let pct = Math.round(
      MATCH_PERCENT_FLOOR + relative * (MATCH_PERCENT_CEIL - MATCH_PERCENT_FLOOR),
    );
    if (rank < TOP3_MATCH_MIN.length) {
      pct = Math.max(pct, TOP3_MATCH_MIN[rank]);
    }
    out[i] = Math.min(MATCH_PERCENT_CEIL, pct);
  });

  return out;
}

function applyCalibratedMatchPercents(
  scored: HybridScoredCandidate[],
): HybridScoredCandidate[] {
  const combined = scored.map((s) => s.combinedScore);
  const percents = calibrateToMatchPercents(combined);
  return scored.map((s, i) => ({ ...s, matchPercent: percents[i] }));
}

/** Same formula for every candidate — keeps list % in sync with final card. */
export function scoreAllHybrid(
  candidates: RankableCandidate[],
  tfScoresByGameId: Map<string, number>,
): HybridScoredCandidate[] {
  if (!candidates.length) return [];

  const tfRaw = candidates.map((c) => tfScoresByGameId.get(c.gameId) ?? 0);
  const tfNorm = minMaxNormalize(tfRaw);

  const scored = candidates.map((c, i) => {
    const combined =
      HYBRID_RANK_WEIGHT * rankInput(c) + HYBRID_TF_WEIGHT * tfNorm[i];
    return {
      ...c,
      combinedScore: combined,
      matchPercent: 0,
    };
  });

  return applyCalibratedMatchPercents(scored);
}

export function pickHybridRecommendation(
  candidates: RankableCandidate[],
  tfScoresByGameId: Map<string, number>,
): HybridScoredCandidate | null {
  if (!candidates.length) return null;

  const byRank = [...candidates].sort((a, b) => rankInput(b) - rankInput(a));
  const topRank = rankInput(byRank[0]);
  const shortlistIds = new Set(
    byRank
      .filter((c) => rankInput(c) >= topRank - RANK_TIE_EPSILON)
      .slice(0, HYBRID_SHORTLIST_SIZE)
      .map((c) => c.gameId),
  );

  const scored = scoreAllHybrid(candidates, tfScoresByGameId);
  const finalists = scored.filter((s) => shortlistIds.has(s.gameId));
  if (!finalists.length) return scored[0] ?? null;

  return finalists.reduce((best, cur) =>
    cur.combinedScore > best.combinedScore ? cur : best,
  );
}

/** Calibrate rank-only scores for display before TF.js completes. */
export function calibrateRankScoresToMatchPercent(
  candidates: RankableCandidate[],
): Map<string, number> {
  const values = candidates.map((c) => rankInput(c));
  const percents = calibrateToMatchPercents(values);
  return new Map(candidates.map((c, i) => [String(c.gameId), percents[i]]));
}
