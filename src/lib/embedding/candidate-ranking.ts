import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric } from "@/types/embedding";
import type { EmbeddingContext } from "./context";
import {
  getCoOccurrenceBlend,
  getLastPlayedBlend,
  getOverlapBlend,
  getPopularityBlend,
  getQualityBlend,
  getStudioBlend,
  getTierBlend,
} from "./config";
import {
  computeCoOccurrenceAffinity,
  type CoOccurrenceIndex,
} from "./co-occurrence-score";
import { computeProfileGameOverlap } from "./profile-overlap";
import { computeMultiAnchorAffinity } from "./last-played";
import {
  computeStudioAffinity,
  computeTierAffinity,
  getTierStudioMultiplier,
} from "./game-tier";
import { applyTasteAdjustment, type TasteSignals } from "./taste-signals";
import { getGamePopularity, passesSocialProofFloor } from "./social-proof";

export type CandidateRankingContext = {
  profile: NormalizedUserProfile;
  profileTags: string[];
  taste: TasteSignals;
  embeddingCtx: EmbeddingContext;
  metric: DistanceMetric;
  anchorCatalogGames: NormalizedGame[];
  coOccurrenceIndex: CoOccurrenceIndex | null;
  libraryCoOccurrenceWeights: Map<string, number>;
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
  coOccurrenceAffinity: number | null;
  game: NormalizedGame;
  anchorGame: NormalizedGame | null;
}): number {
  const overlapW = getOverlapBlend();
  const popW = getPopularityBlend();
  const qualityW = getQualityBlend();
  const lastPlayedW = input.lastPlayedAffinity != null ? getLastPlayedBlend() : 0;
  const tierW = input.tierAffinity != null ? getTierBlend() : 0;
  const studioW = input.studioAffinity != null ? getStudioBlend() : 0;
  const coOccW =
    input.coOccurrenceAffinity != null ? getCoOccurrenceBlend() : 0;
  const tasteW = Math.max(
    0.22,
    1 - popW - qualityW - lastPlayedW - tierW - studioW - coOccW,
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
  if (input.coOccurrenceAffinity != null) {
    score += input.coOccurrenceAffinity * coOccW;
  }

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
): { rankScore: number; popularityScore: number; anchorAffinity: number } | null {
  if (!passesSocialProofFloor(game)) return null;

  const anchors = ctx.anchorCatalogGames;
  const primaryAnchor = anchors[0] ?? null;
  const popularity = getGamePopularity(game);
  const overlap = computeProfileGameOverlap(
    ctx.profile,
    game,
    ctx.profileTags,
    anchors,
  );
  const quality = getQualityScore(game);

  const anchorAffinity =
    anchors.length > 0
      ? computeMultiAnchorAffinity(
          game,
          anchors,
          ctx.embeddingCtx,
          ctx.metric,
        )
      : 0;

  const lastPlayedAffinity = anchors.length ? anchorAffinity : null;

  const tierAffinity = primaryAnchor
    ? computeTierAffinity(primaryAnchor, game)
    : null;
  const studioAffinity = primaryAnchor
    ? computeStudioAffinity(primaryAnchor, game)
    : null;

  const coOccurrenceAffinity =
    ctx.coOccurrenceIndex && ctx.libraryCoOccurrenceWeights.size > 0
      ? computeCoOccurrenceAffinity(
          game.id,
          ctx.libraryCoOccurrenceWeights,
          ctx.coOccurrenceIndex,
        )
      : null;

  const base = computeCandidateRankScore({
    vectorScore,
    popularity,
    overlap,
    quality,
    lastPlayedAffinity,
    tierAffinity,
    studioAffinity,
    coOccurrenceAffinity,
    game,
    anchorGame: primaryAnchor,
  });

  return {
    rankScore: applyTasteAdjustment(base, game, ctx.taste),
    popularityScore: popularity,
    anchorAffinity,
  };
}
