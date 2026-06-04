import type { NormalizedGame } from "@/types/game";

export type SocialMetrics = {
  positive: number;
  recommendations: number;
  ownersMid: number;
};

/** Minimum reviews / recommendations for recommendation pool (default 5k). */
export const SOCIAL_PROOF_MIN_POSITIVE = 5_000;
export const SOCIAL_PROOF_MIN_RECOMMENDATIONS = 5_000;

export function getSocialMetrics(game: NormalizedGame): SocialMetrics {
  return {
    positive: game.positiveReviews ?? Number(game.raw?.positive ?? 0),
    recommendations:
      game.recommendations ?? Number(game.raw?.recommendations ?? 0),
    ownersMid: game.estimatedOwnersMid ?? Number(game.raw?.ownersMid ?? 0),
  };
}

/**
 * Hard floor — at least 5k positive reviews AND 5k Steam recommendations
 * (with exceptions for mega-hits).
 */
export function passesSocialProofFloor(game: NormalizedGame): boolean {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (ownersMid >= 2_000_000) return true;
  if (positive >= 50_000 || recommendations >= 40_000) return true;

  if (
    positive >= SOCIAL_PROOF_MIN_POSITIVE &&
    recommendations >= SOCIAL_PROOF_MIN_RECOMMENDATIONS
  ) {
    return true;
  }

  if (positive >= 8_000 && recommendations >= 3_000) return true;
  if (combined >= 12_000) return true;

  return false;
}

/** Softer floor when the vector pool is too small after filtering. */
export function passesSocialProofFloorRelaxed(game: NormalizedGame): boolean {
  if (passesSocialProofFloor(game)) return true;
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (combined < 2_000) return false;
  if (positive >= 3_000 && recommendations >= 2_000) return true;
  if (positive >= 4_000 || recommendations >= 4_000) return true;
  return ownersMid >= 500_000;
}

/** Last-resort floor so the pool is never empty after vector + popular fallback. */
export function passesSocialProofFloorEmergency(game: NormalizedGame): boolean {
  if (passesSocialProofFloorRelaxed(game)) return true;
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (combined < 800) return false;
  if (positive >= 1_000 && recommendations >= 800) return true;
  if (combined >= 2_500) return true;
  return ownersMid >= 100_000;
}

export type SocialProofFloorMode = "strict" | "relaxed" | "emergency";

export function passesSocialProofByMode(
  game: NormalizedGame,
  mode: SocialProofFloorMode,
): boolean {
  if (mode === "strict") return passesSocialProofFloor(game);
  if (mode === "relaxed") return passesSocialProofFloorRelaxed(game);
  return passesSocialProofFloorEmergency(game);
}

export function getSocialProofMultiplier(game: NormalizedGame): number {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  let mult = 1;

  if (positive >= 50_000 || recommendations >= 40_000) {
    mult = 1.12;
  } else if (positive >= 20_000 || recommendations >= 15_000) {
    mult = 1.08;
  } else if (positive >= 10_000 || recommendations >= 8_000) {
    mult = 1.04;
  }

  if (combined < 500) {
    mult *= 0.04;
  } else if (positive < 2_000 || recommendations < 2_000) {
    mult *= 0.35;
  } else if (
    positive < SOCIAL_PROOF_MIN_POSITIVE ||
    recommendations < SOCIAL_PROOF_MIN_RECOMMENDATIONS
  ) {
    mult *= 0.68;
  }

  if (ownersMid > 0 && ownersMid < 80_000) {
    mult *= 0.9;
  }

  const isEarlyAccess =
    game.genre?.toLowerCase().includes("early access") ||
    game.tags.some((t) => /early access/i.test(t));
  if (isEarlyAccess && positive < 10_000) {
    mult *= 0.85;
  }

  return mult;
}

export function getGamePopularityFromMetrics(metrics: SocialMetrics): number {
  const { positive, recommendations, ownersMid } = metrics;
  const positiveN = Math.min(1, Math.log10(positive + 1) / 6);
  const recN = Math.min(1, Math.log10(recommendations + 1) / 5.5);
  const ownerN = Math.min(1, Math.log10(ownersMid + 1) / 8);
  return positiveN * 0.45 + recN * 0.35 + ownerN * 0.2;
}

export function getGamePopularity(game: NormalizedGame): number {
  const metrics = getSocialMetrics(game);
  const computed = getGamePopularityFromMetrics(metrics);

  if (game.popularityScore != null && game.popularityScore > 0) {
    return Math.max(computed, game.popularityScore * 0.85);
  }

  return computed;
}
