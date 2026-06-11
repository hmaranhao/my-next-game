import type { NormalizedGame } from "@/types/game";
import { splitGenreTokens } from "@/lib/embedding/genre-utils";
import { normMetadataToken } from "@/lib/embedding/steam-metadata-utils";
import { hasMajorPublisherHint } from "./publisher-hints";
import { getSocialMetrics } from "./social-metrics";

/** Established title — enough owners to be mainstream on Steam. */
export const CATALOG_MIN_OWNERS = 1_000_000;
/** Social proof floor for curated recommendations (reviews or recs). */
export const CATALOG_MIN_POSITIVE = 200_000;
export const CATALOG_MIN_RECOMMENDATIONS = 200_000;
/** Publisher-backed titles can enter with a lower social floor. */
export const CATALOG_PUBLISHER_MIN_POSITIVE = 100_000;
export const CATALOG_PUBLISHER_MIN_RECOMMENDATIONS = 100_000;

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

/**
 * Mainstream established catalog gate:
 * - 1M+ owners, no Casual
 * - 200k+ reviews or recs, OR major publisher with 100k+ reviews/recs
 */
export function isCatalogEligible(game: NormalizedGame): boolean {
  if (isCasualGame(game)) return false;

  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  if (ownersMid < CATALOG_MIN_OWNERS) return false;

  const passesStandardFloor =
    positive >= CATALOG_MIN_POSITIVE ||
    recommendations >= CATALOG_MIN_RECOMMENDATIONS;

  if (passesStandardFloor) return true;

  if (!hasMajorPublisherHint(game)) return false;

  return (
    positive >= CATALOG_PUBLISHER_MIN_POSITIVE ||
    recommendations >= CATALOG_PUBLISHER_MIN_RECOMMENDATIONS
  );
}
