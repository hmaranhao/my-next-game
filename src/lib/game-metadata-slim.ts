import type { NormalizedGame } from "../types/game";

/** Minimal game payload for pgvector index (Neon free tier ~512 MB). */
export function slimGameForIndex(game: NormalizedGame): NormalizedGame {
  return {
    id: game.id,
    steamAppId: game.steamAppId,
    name: game.name,
    genre: game.genre,
    platform: game.platform,
    year: game.year,
    rating: game.rating,
    tags: game.tags.slice(0, 24),
    price: game.price,
    publisher: game.publisher,
    popularityScore: game.popularityScore,
    positiveReviews: game.positiveReviews,
    recommendations: game.recommendations,
    estimatedOwners: game.estimatedOwners,
    estimatedOwnersMid: game.estimatedOwnersMid,
    shortDescription: game.shortDescription
      ? String(game.shortDescription).slice(0, 280)
      : null,
    headerImage: game.headerImage ?? null,
    screenshots: [],
    developers: game.developers?.slice(0, 3),
    raw: {
      positive: game.raw?.positive ?? null,
      recommendations: game.raw?.recommendations ?? null,
    },
  };
}

/** Rough Neon free-tier guidance (512 MB project limit). */
export const NEON_FREE_TIER_GAME_CAP = 90_000;
