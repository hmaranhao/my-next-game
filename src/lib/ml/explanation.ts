import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import { resolveLastPlayedEntry } from "@/lib/embedding/last-played";
import { splitGenreTokens } from "@/lib/embedding/genre-utils";
import {
  classifyGameTier,
  type GameProductionTier,
} from "@/lib/embedding/game-tier";

export type ExplanationPayload = {
  explanationKey: string;
  explanationValues: Record<string, string | number>;
};

const LOW_MATCH_THRESHOLD = 55;

const TIER_LABELS: Record<GameProductionTier, string> = {
  AAA: "AAA",
  AA: "AA",
  INDIE: "indie",
};

/** Template-based explanation for i18n (pt-BR / en-US). */
export function buildRecommendationExplanation(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  matchPercent: number,
  candidatePoolSize = 1000,
  anchorTier?: GameProductionTier | null,
): ExplanationPayload {
  const pool = candidatePoolSize;
  const lastPlayed =
    resolveLastPlayedEntry(profile)?.name ??
    profile.topGames[0]?.name ??
    profile.playedGameNames[0] ??
    "";

  const candidateTier = classifyGameTier(game);
  const tierMatch =
    anchorTier && anchorTier === candidateTier ? anchorTier : null;

  if (matchPercent < LOW_MATCH_THRESHOLD) {
    return {
      explanationKey: "recommendation.explainLowMatch",
      explanationValues: {
        game: game.name,
        match: matchPercent,
        pool,
      },
    };
  }

  if (tierMatch && lastPlayed) {
    return {
      explanationKey: "recommendation.explainTierMatch",
      explanationValues: {
        game: game.name,
        played: lastPlayed,
        tier: TIER_LABELS[tierMatch],
        match: matchPercent,
      },
    };
  }

  const sharedGenre = profile.inferredGenres.find((g) =>
    splitGenreTokens(game.genre).some(
      (gt) => gt.toLowerCase() === g.toLowerCase(),
    ),
  );
  const sharedTag = (profile.steamTags ?? []).find((tag) =>
    game.tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
  );

  if (lastPlayed) {
    return {
      explanationKey: "recommendation.explainLastPlayed",
      explanationValues: {
        game: game.name,
        played: lastPlayed,
        match: matchPercent,
      },
    };
  }

  if (sharedTag) {
    return {
      explanationKey: "recommendation.explainTagAndHistory",
      explanationValues: {
        tag: sharedTag,
        game: game.name,
        played: lastPlayed,
        match: matchPercent,
      },
    };
  }

  if (sharedGenre) {
    return {
      explanationKey: "recommendation.explainGenre",
      explanationValues: {
        genre: sharedGenre,
        game: game.name,
        match: matchPercent,
      },
    };
  }

  if (game.platform) {
    return {
      explanationKey: "recommendation.explainPlatform",
      explanationValues: {
        platform: game.platform,
        game: game.name,
        match: matchPercent,
      },
    };
  }

  return {
    explanationKey: "recommendation.explainGeneric",
    explanationValues: {
      game: game.name,
      match: matchPercent,
      pool,
    },
  };
}
