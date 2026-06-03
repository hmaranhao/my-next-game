import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import { getProfileLibraryEntries } from "@/lib/embedding/played-games";

export type ExplanationPayload = {
  explanationKey: string;
  explanationValues: Record<string, string | number>;
};

const LOW_MATCH_THRESHOLD = 15;

/** Template-based explanation for i18n (pt-BR / en-US). */
export function buildRecommendationExplanation(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  matchPercent: number,
  candidatePoolSize = 1000,
): ExplanationPayload {
  const pool = candidatePoolSize;

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

  const sharedGenre = profile.inferredGenres.find(
    (g) => g.toLowerCase() === (game.genre ?? "").toLowerCase(),
  );
  const topPlayed =
    getProfileLibraryEntries(profile)[0]?.name ??
    profile.topGames[0]?.name ??
    profile.playedGameNames[0] ??
    "";

  if (sharedGenre && topPlayed) {
    return {
      explanationKey: "recommendation.explainGenreAndHistory",
      explanationValues: {
        genre: sharedGenre,
        game: game.name,
        played: topPlayed,
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
