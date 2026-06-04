import type { NormalizedGame } from "@/types/game";
import { getPopularityBlend } from "./config";
import { getGamePopularity as getPopularityFromSocialProof } from "./social-proof";

/** Log-scaled 0–1 from positive reviews, recommendations and owner estimates. */
export function getGamePopularity(game: NormalizedGame): number {
  return getPopularityFromSocialProof(game);
}

/** @deprecated — use computeCandidateRankScore from candidate-ranking.ts */
export function blendRankScore(vectorScore: number, popularity: number): number {
  const blend = getPopularityBlend();
  const boost = 0.6 + 0.4 * popularity;
  return vectorScore * (1 - blend) + vectorScore * boost * blend;
}
