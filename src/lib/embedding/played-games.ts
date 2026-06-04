import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile, ProfileGameEntry } from "@/types/profile";
import type { EmbeddingContext } from "./context";
import { encodeGameVector, vectorToArray } from "./encode";
import { findCatalogGame, type GameLookup } from "@/lib/game-lookup";
import { splitGenreTokens } from "./genre-utils";
import {
  entryPlaytimeWeight,
  LIBRARY_ENCODE_LIMIT,
  MEANINGFUL_ANCHOR_PLAYTIME_MINUTES,
  TF_LIBRARY_VECTOR_LIMIT,
  weightedAverageVectors,
} from "./playtime-weights";

export type LibraryCatalogMatch = {
  entry: ProfileGameEntry;
  game: NormalizedGame;
  weight: number;
};

/** Unified library source: full Steam library when available, else top + recent. */
export function getProfileLibraryEntries(
  profile: NormalizedUserProfile,
): ProfileGameEntry[] {
  const source =
    (profile.libraryGames?.length ?? 0) > 0
      ? profile.libraryGames!
      : [...profile.topGames, ...profile.recentGames];

  const seen = new Set<number | string>();
  const out: ProfileGameEntry[] = [];

  for (const entry of source) {
    const key = entry.appId > 0 ? entry.appId : entry.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(entry);
  }

  return out.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);
}

export function hasMeaningfulAnchorPlaytime(entry: ProfileGameEntry): boolean {
  return entry.playtimeMinutes >= MEANINGFUL_ANCHOR_PLAYTIME_MINUTES;
}

/**
 * Recommendation anchor: recent Steam session among titles with 10h+ total playtime.
 * Skips "testei 5 minutos e fechei" entries in the recent list.
 */
export function resolveMeaningfulLastPlayedAnchor(
  recentGames: ProfileGameEntry[],
  libraryGames: ProfileGameEntry[],
): ProfileGameEntry | null {
  for (const entry of recentGames) {
    if (hasMeaningfulAnchorPlaytime(entry)) return entry;
  }

  const withRecency = libraryGames
    .filter(hasMeaningfulAnchorPlaytime)
    .filter((e) => e.lastPlayedAt);

  if (withRecency.length) {
    return withRecency.sort(
      (a, b) =>
        new Date(b.lastPlayedAt!).getTime() -
        new Date(a.lastPlayedAt!).getTime(),
    )[0];
  }

  const byPlaytime = libraryGames.filter(hasMeaningfulAnchorPlaytime);
  if (byPlaytime.length) {
    return byPlaytime.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)[0];
  }

  return null;
}

/** Meaningful last-played anchor for ranking (10h+ playtime). */
export function resolveLastPlayedEntry(
  profile: NormalizedUserProfile,
): ProfileGameEntry | null {
  if (
    profile.lastPlayedGame &&
    hasMeaningfulAnchorPlaytime(profile.lastPlayedGame)
  ) {
    return profile.lastPlayedGame;
  }

  return resolveMeaningfulLastPlayedAnchor(
    profile.recentGames,
    profile.libraryGames?.length
      ? profile.libraryGames
      : [...profile.topGames, ...profile.recentGames],
  );
}

/** Map library entries to catalog games with playtime/recency weights. */
export function collectLibraryCatalogMatches(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = LIBRARY_ENCODE_LIMIT,
): LibraryCatalogMatch[] {
  const matches: LibraryCatalogMatch[] = [];
  const lastEntry = resolveLastPlayedEntry(profile);
  const lastAppId = lastEntry?.appId ?? 0;
  const seenAppIds = new Set<number>();

  if (lastEntry && lastAppId > 0) {
    const lastGame = findCatalogGame(
      lastEntry.name,
      lastEntry.appId,
      lookup,
      games,
    );
    if (lastGame) {
      matches.push({
        entry: lastEntry,
        game: lastGame,
        weight: entryPlaytimeWeight(lastEntry) * 3,
      });
      seenAppIds.add(lastAppId);
    }
  }

  for (const entry of getProfileLibraryEntries(profile)) {
    if (entry.appId > 0 && seenAppIds.has(entry.appId)) continue;
    const game = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!game) continue;

    const isLastPlayed = entry.appId > 0 && entry.appId === lastAppId;
    const weight = entryPlaytimeWeight(entry) * (isLastPlayed ? 3 : 1);

    matches.push({
      entry,
      game,
      weight,
    });

    if (matches.length >= limit) break;
  }

  return matches;
}

/** Weighted average of library game vectors for TF.js user encoding. */
export function encodePlayedLibraryWeightedVector(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  ctx: EmbeddingContext,
  lookup: GameLookup,
  limit = TF_LIBRARY_VECTOR_LIMIT,
): number[] | null {
  const matches = collectLibraryCatalogMatches(profile, games, lookup, limit);
  if (!matches.length) return null;

  const vectors = matches.map((m) =>
    vectorToArray(encodeGameVector(m.game, ctx)),
  );
  const weights = matches.map((m) => m.weight);

  return weightedAverageVectors(vectors, weights);
}

/** @deprecated Prefer encodePlayedLibraryWeightedVector — kept for fallback. */
export function encodePlayedLibraryVectors(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  ctx: EmbeddingContext,
  lookup: GameLookup,
  limit = TF_LIBRARY_VECTOR_LIMIT,
): number[][] {
  const matches = collectLibraryCatalogMatches(profile, games, lookup, limit);
  return matches.map((m) => vectorToArray(encodeGameVector(m.game, ctx)));
}

/** Tags from library (playtime + recency weighted). */
export function collectProfileTags(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = 24,
): string[] {
  const tagWeights = new Map<string, number>();
  const matches = collectLibraryCatalogMatches(
    profile,
    games,
    lookup,
    LIBRARY_ENCODE_LIMIT,
  );

  for (const { game, weight } of matches) {
    if (!game.tags.length && !game.genre) continue;

    for (const tag of game.tags) {
      const t = tag.trim();
      if (!t) continue;
      tagWeights.set(t, (tagWeights.get(t) ?? 0) + weight);
    }

    if (game.genre) {
      tagWeights.set(game.genre, (tagWeights.get(game.genre) ?? 0) + weight * 0.6);
    }
  }

  for (const genre of profile.inferredGenres) {
    tagWeights.set(genre, (tagWeights.get(genre) ?? 0) + 0.5);
  }

  for (const tag of profile.steamTags ?? []) {
    tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + 1.2);
  }

  const lastEntry = resolveLastPlayedEntry(profile);
  if (lastEntry) {
    const lastGame = findCatalogGame(lastEntry.name, lastEntry.appId, lookup, games);
    if (lastGame) {
      for (const tag of lastGame.tags) {
        const t = tag.trim();
        if (t) tagWeights.set(t, (tagWeights.get(t) ?? 0) + 2.5);
      }
      for (const g of splitGenreTokens(lastGame.genre)) {
        tagWeights.set(g, (tagWeights.get(g) ?? 0) + 1.8);
      }
    }
  }

  return [...tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
