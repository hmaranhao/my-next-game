import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric } from "@/types/embedding";
import type { EmbeddingContext } from "./context";
import {
  getLastPlayedBlend,
  getOverlapBlend,
  getPopularityBlend,
  getQualityBlend,
  getStudioBlend,
  getTierBlend,
} from "./config";
import { computeProfileGameOverlap } from "./profile-overlap";
import { computeLastPlayedAffinity } from "./last-played";
import {
  computeStudioAffinity,
  computeTierAffinity,
  getTierStudioMultiplier,
} from "./game-tier";
import { applyTasteAdjustment, type TasteSignals } from "./taste-signals";
import {
  getGamePopularity,
  getSocialProofMultiplier,
  passesSocialProofByMode,
  passesSocialProofFloor,
  type SocialProofFloorMode,
} from "./social-proof";

export type CandidateRankingContext = {
  profile: NormalizedUserProfile;
  profileTags: string[];
  taste: TasteSignals;
  embeddingCtx: EmbeddingContext;
  metric: DistanceMetric;
  lastPlayedCatalogGame: NormalizedGame | null;
};

export function getQualityScore(game: NormalizedGame): number {
  if (game.rating == null || !Number.isFinite(game.rating)) return 0.5;
  return Math.min(1, Math.max(0, game.rating / 10));
}

export function computeCandidateRankScore(input: {
  vectorScore: number;
  popularity: number;
  overlap: number;
  quality: number;
  lastPlayedAffinity: number | null;
  tierAffinity: number | null;
  studioAffinity: number | null;
  game: NormalizedGame;
  anchorGame: NormalizedGame | null;
}): number {
  const overlapW = getOverlapBlend();
  const popW = getPopularityBlend();
  const qualityW = getQualityBlend();
  const lastPlayedW = input.lastPlayedAffinity != null ? getLastPlayedBlend() : 0;
  const tierW = input.tierAffinity != null ? getTierBlend() : 0;
  const studioW = input.studioAffinity != null ? getStudioBlend() : 0;
  const tasteW = Math.max(
    0.22,
    1 - popW - qualityW - lastPlayedW - tierW - studioW,
  );

  const tasteCore =
    input.vectorScore * (1 - overlapW) + input.overlap * overlapW;

  let score =
    tasteCore * tasteW +
    input.popularity * popW +
    input.quality * qualityW;

  if (input.lastPlayedAffinity != null) {
    score += input.lastPlayedAffinity * lastPlayedW;
  }
  if (input.tierAffinity != null) {
    score += input.tierAffinity * tierW;
  }
  if (input.studioAffinity != null) {
    score += input.studioAffinity * studioW;
  }

  score *= getSocialProofMultiplier(input.game);
  score *= getTierStudioMultiplier(input.anchorGame, input.game);

  return Math.max(0, Math.min(1, score));
}

export function isRecommendableCandidate(game: NormalizedGame): boolean {
  return passesSocialProofFloor(game);
}

export function scoreCandidateForRanking(
  game: NormalizedGame,
  vectorScore: number,
  ctx: CandidateRankingContext,
  options?: { floor?: SocialProofFloorMode },
): { rankScore: number; popularityScore: number } | null {
  const floor = options?.floor ?? "strict";
  if (!passesSocialProofByMode(game, floor)) return null;

  const anchor = ctx.lastPlayedCatalogGame;
  const popularity = getGamePopularity(game);
  const overlap = computeProfileGameOverlap(
    ctx.profile,
    game,
    ctx.profileTags,
  );
  const quality = getQualityScore(game);

  const lastPlayedAffinity = anchor
    ? computeLastPlayedAffinity(
        game,
        anchor,
        ctx.embeddingCtx,
        ctx.metric,
      )
    : null;

  const tierAffinity = anchor ? computeTierAffinity(anchor, game) : null;
  const studioAffinity = anchor ? computeStudioAffinity(anchor, game) : null;

  const base = computeCandidateRankScore({
    vectorScore,
    popularity,
    overlap,
    quality,
    lastPlayedAffinity,
    tierAffinity,
    studioAffinity,
    game,
    anchorGame: anchor,
  });

  return {
    rankScore: applyTasteAdjustment(base, game, ctx.taste),
    popularityScore: popularity,
  };
}
