import type { NormalizedGame } from "@/types/game";
import { isCatalogEligible } from "@/lib/catalog/eligibility";
import {
  getSocialMetrics,
  type SocialMetrics,
} from "@/lib/catalog/social-metrics";

export type { SocialMetrics };
export { getSocialMetrics };

/** @deprecated use catalog eligibility — kept for tests/scripts */
export const SOCIAL_PROOF_MIN_POSITIVE = 200_000;
export const SOCIAL_PROOF_MIN_RECOMMENDATIONS = 200_000;
export const SOCIAL_PROOF_PUBLISHER_MIN_POSITIVE = 100_000;
export const SOCIAL_PROOF_PUBLISHER_MIN_RECOMMENDATIONS = 100_000;

/** Catalog is pre-filtered; all indexed games pass this floor. */
export function passesSocialProofFloor(game: NormalizedGame): boolean {
  return isCatalogEligible(game);
}

export function passesSocialProofFloorRelaxed(game: NormalizedGame): boolean {
  return passesSocialProofFloor(game);
}

export function passesSocialProofFloorEmergency(game: NormalizedGame): boolean {
  return passesSocialProofFloor(game);
}

export type SocialProofFloorMode = "strict" | "relaxed" | "emergency";

export function passesSocialProofByMode(
  game: NormalizedGame,
  mode: SocialProofFloorMode,
): boolean {
  return passesSocialProofFloor(game);
}

export function getSocialProofMultiplier(game: NormalizedGame): number {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  let mult = 1;

  if (positive >= 50_000 || recommendations >= 40_000) {
    mult = 1.1;
  } else if (positive >= 20_000 || recommendations >= 15_000) {
    mult = 1.06;
  } else if (positive >= 10_000 || recommendations >= 8_000) {
    mult = 1.03;
  }

  if (ownersMid > 0 && ownersMid < 500_000) {
    mult *= 0.92;
  }

  const isEarlyAccess =
    game.genre?.toLowerCase().includes("early access") ||
    game.tags.some((t) => /early access/i.test(t));
  if (isEarlyAccess && positive < 10_000) {
    mult *= 0.9;
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
