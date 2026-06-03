import type { NormalizedGame } from "@/types/game";
import { POPULARITY_BLEND } from "./config";

/** Log-scaled 0–1 from positive reviews, recommendations and owner estimates. */
export function getGamePopularity(game: NormalizedGame): number {
  if (game.popularityScore != null && game.popularityScore > 0) {
    return game.popularityScore;
  }

  const positive = game.positiveReviews ?? Number(game.raw?.positive ?? 0);
  const recommendations =
    game.recommendations ?? Number(game.raw?.recommendations ?? 0);
  const owners = game.estimatedOwnersMid ?? Number(game.raw?.ownersMid ?? 0);

  const signal = positive + recommendations * 0.75 + owners * 1e-7;
  return Math.min(1, Math.log10(signal + 1) / 7);
}

/** Blend vector similarity with popularity (downloads / positive reviews). */
export function blendRankScore(vectorScore: number, popularity: number): number {
  const boost = 0.6 + 0.4 * popularity;
  return vectorScore * (1 - POPULARITY_BLEND) + vectorScore * boost * POPULARITY_BLEND;
}
