import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import {
  resolveLastPlayedEntry,
  resolveMeaningful10hAnchors,
} from "@/lib/embedding/last-played";
import {
  collectGameGenres,
  collectGameplayTags,
  normMetadataToken,
} from "@/lib/embedding/steam-metadata-utils";
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

function formatAnchorNames(profile: NormalizedUserProfile): string {
  const anchors = resolveMeaningful10hAnchors(profile, 3);
  if (anchors.length >= 2) {
    return anchors
      .slice(0, 2)
      .map((a) => a.name)
      .join(", ");
  }
  return (
    resolveLastPlayedEntry(profile)?.name ??
    profile.topGames[0]?.name ??
    profile.playedGameNames[0] ??
    ""
  );
}

/** Template-based explanation for i18n (pt-BR / en-US). */
export function buildRecommendationExplanation(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  matchPercent: number,
  candidatePoolSize = 1000,
  anchorTier?: GameProductionTier | null,
): ExplanationPayload {
  const pool = candidatePoolSize;
  const anchorNames = formatAnchorNames(profile);
  const lastPlayed = resolveLastPlayedEntry(profile)?.name ?? anchorNames;

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

  const anchors = resolveMeaningful10hAnchors(profile, 2);
  if (anchors.length >= 2 && anchorNames) {
    return {
      explanationKey: "recommendation.explainMultiAnchor",
      explanationValues: {
        game: game.name,
        played: anchorNames,
        match: matchPercent,
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

  const candidateGenres = new Set(collectGameGenres(game));
  const sharedGenre = profile.inferredGenres.find((g) =>
    candidateGenres.has(normMetadataToken(g)),
  );
  const sharedTag = collectGameplayTags(game).find((tag) =>
    (profile.steamTags ?? []).some(
      (profileTag) => normMetadataToken(profileTag) === tag,
    ),
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
