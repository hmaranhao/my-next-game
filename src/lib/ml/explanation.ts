import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";

export type ExplanationPayload = {
  explanationKey: string;
  explanationValues: Record<string, string | number>;
};

/** Template-based explanation for i18n (pt-BR / en-US). */
export function buildRecommendationExplanation(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  matchPercent: number,
): ExplanationPayload {
  const sharedGenre = profile.inferredGenres.find(
    (g) => g.toLowerCase() === (game.genre ?? "").toLowerCase(),
  );
  const topPlayed = profile.topGames[0]?.name ?? profile.playedGameNames[0] ?? "";

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
    },
  };
}
