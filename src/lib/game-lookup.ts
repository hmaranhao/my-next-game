import type { NormalizedGame } from "@/types/game";
import { normalizeGameName } from "@/lib/embedding/search";

export type GameLookup = {
  byAppId: Map<number, NormalizedGame>;
  byName: Map<string, NormalizedGame>;
};

export function buildGameLookup(games: NormalizedGame[]): GameLookup {
  const byAppId = new Map<number, NormalizedGame>();
  const byName = new Map<string, NormalizedGame>();

  for (const game of games) {
    if (game.steamAppId != null) {
      byAppId.set(game.steamAppId, game);
    }
    const parsedId = Number.parseInt(game.id, 10);
    if (Number.isFinite(parsedId)) {
      byAppId.set(parsedId, game);
    }
    byName.set(normalizeGameName(game.name), game);
  }

  return { byAppId, byName };
}

/** Merge pgvector slim metadata with full catalog fields (reviews, devs, etc.). */
export function enrichCatalogGame(
  game: NormalizedGame,
  lookup: GameLookup,
): NormalizedGame {
  const parsedId = Number.parseInt(game.id, 10);
  const appId =
    game.steamAppId ??
    (Number.isFinite(parsedId) ? parsedId : null);
  const full = findCatalogGame(game.name, appId, lookup, []);
  if (!full) return game;

  return {
    ...full,
    ...game,
    positiveReviews: game.positiveReviews ?? full.positiveReviews,
    recommendations: game.recommendations ?? full.recommendations,
    estimatedOwnersMid: game.estimatedOwnersMid ?? full.estimatedOwnersMid,
    estimatedOwners: game.estimatedOwners ?? full.estimatedOwners,
    publisher: game.publisher ?? full.publisher,
    developers: game.developers?.length ? game.developers : full.developers,
    tags: game.tags?.length ? game.tags : full.tags,
    raw: { ...full.raw, ...game.raw },
  };
}

export function findCatalogGame(
  steamName: string,
  appId: number | null | undefined,
  lookup: GameLookup,
  games: NormalizedGame[],
): NormalizedGame | null {
  if (appId != null && lookup.byAppId.has(appId)) {
    return lookup.byAppId.get(appId)!;
  }

  const key = normalizeGameName(steamName);
  if (key && lookup.byName.has(key)) {
    return lookup.byName.get(key)!;
  }

  if (key.length > 4) {
    for (const game of games) {
      const catalogKey = normalizeGameName(game.name);
      if (catalogKey.includes(key) || key.includes(catalogKey)) {
        return game;
      }
    }
  }

  return null;
}
