import type { NormalizedGame } from "@/types/game";
import { splitGenreTokens } from "@/lib/embedding/genre-utils";
import { normMetadataToken } from "@/lib/embedding/steam-metadata-utils";
import { getSocialMetrics } from "./social-metrics";

export const CATALOG_MIN_OWNERS = 1_000_000;
export const CATALOG_MIN_POSITIVE = 500_000;
export const CATALOG_MIN_RECOMMENDATIONS = 500_000;
export const CATALOG_INDIE_MIN_POSITIVE = 1_000_000;
export const CATALOG_INDIE_MIN_RECOMMENDATIONS = 1_000_000;

function hasMetadataToken(game: NormalizedGame, token: string): boolean {
  const target = normMetadataToken(token);
  for (const g of splitGenreTokens(game.genre)) {
    if (normMetadataToken(g) === target) return true;
  }
  for (const tag of game.tags) {
    if (normMetadataToken(tag) === target) return true;
  }
  return false;
}

/** Steam tag/genre Casual — excluded from recommendations catalog. */
export function isCasualGame(game: NormalizedGame): boolean {
  return hasMetadataToken(game, "casual");
}

/** Indie label on Steam (genre or community tag). */
export function isIndieLabeledGame(game: NormalizedGame): boolean {
  return hasMetadataToken(game, "indie");
}

/**
 * Mega-title gate: 1M+ owners, 500k+ reviews/recs (1M+ for indie-labeled games).
 * Casual-tagged games are excluded.
 */
export function isCatalogEligible(game: NormalizedGame): boolean {
  if (isCasualGame(game)) return false;

  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  if (ownersMid < CATALOG_MIN_OWNERS) return false;

  const minPositive = isIndieLabeledGame(game)
    ? CATALOG_INDIE_MIN_POSITIVE
    : CATALOG_MIN_POSITIVE;
  const minRecs = isIndieLabeledGame(game)
    ? CATALOG_INDIE_MIN_RECOMMENDATIONS
    : CATALOG_MIN_RECOMMENDATIONS;

  return positive >= minPositive || recommendations >= minRecs;
}
