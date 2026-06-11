import type { NormalizedGame } from "@/types/game";

export type SocialMetrics = {
  positive: number;
  recommendations: number;
  ownersMid: number;
};

export function getSocialMetrics(game: NormalizedGame): SocialMetrics {
  return {
    positive: game.positiveReviews ?? Number(game.raw?.positive ?? 0),
    recommendations:
      game.recommendations ?? Number(game.raw?.recommendations ?? 0),
    ownersMid: game.estimatedOwnersMid ?? Number(game.raw?.ownersMid ?? 0),
  };
}
