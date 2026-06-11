import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile, ProfileGameEntry } from "@/types/profile";
import type { EmbeddingContext } from "./context";
import { encodeGameVector, vectorToArray } from "./encode";
import { findCatalogGame, type GameLookup } from "@/lib/game-lookup";
import {
  collectGameGenres,
  collectGameplayTags,
  isSteamCategory,
  normMetadataToken,
} from "./steam-metadata-utils";
import {
  entryPlaytimeWeight,
  LIBRARY_ENCODE_LIMIT,
  MEANINGFUL_ANCHOR_PLAYTIME_MINUTES,
  recencyMultiplier,
  TF_LIBRARY_VECTOR_LIMIT,
  weightedAverageVectors,
} from "./playtime-weights";

export type LibraryCatalogMatch = {
  entry: ProfileGameEntry;
  game: NormalizedGame;
  weight: number;
};

const FALLBACK_LIBRARY_LIMIT = 10;
/** Extra weight for 10h+ titles when building the full-library query vector. */
const MEANINGFUL_PLAYTIME_BOOST = 1.65;

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
 * Up to N recent meaningful anchors (10h+), most recent first.
 */
export function resolveMeaningful10hAnchors(
  profile: NormalizedUserProfile,
  limit = 5,
): ProfileGameEntry[] {
  const library =
    profile.libraryGames?.length
      ? profile.libraryGames
      : [...profile.topGames, ...profile.recentGames];

  const ordered: ProfileGameEntry[] = [];

  for (const entry of profile.recentGames) {
    if (hasMeaningfulAnchorPlaytime(entry)) ordered.push(entry);
  }

  const library10h = library
    .filter(hasMeaningfulAnchorPlaytime)
    .filter((e) => e.lastPlayedAt)
    .sort(
      (a, b) =>
        new Date(b.lastPlayedAt!).getTime() -
        new Date(a.lastPlayedAt!).getTime(),
    );

  for (const entry of library10h) {
    ordered.push(entry);
  }

  const byPlaytime = library
    .filter(hasMeaningfulAnchorPlaytime)
    .sort((a, b) => b.playtimeMinutes - a.playtimeMinutes);

  for (const entry of byPlaytime) {
    ordered.push(entry);
  }

  const deduped: ProfileGameEntry[] = [];
  const seen = new Set<number>();
  for (const entry of ordered) {
    if (entry.appId > 0 && seen.has(entry.appId)) continue;
    if (entry.appId > 0) seen.add(entry.appId);
    deduped.push(entry);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

/**
 * Recommendation anchor: recent Steam session among titles with 10h+ total playtime.
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

/** Primary anchor for ranking (first 10h+ anchor). */
export function resolveLastPlayedEntry(
  profile: NormalizedUserProfile,
): ProfileGameEntry | null {
  const anchors = resolveMeaningful10hAnchors(profile, 1);
  if (anchors.length) return anchors[0];

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

/**
 * Full playtime-weighted library for profile query vector and co-occurrence.
 * 10h+ titles get a boost; recent session still nudged via entryPlaytimeWeight.
 */
export function collectProfileQueryLibraryMatches(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = LIBRARY_ENCODE_LIMIT,
): LibraryCatalogMatch[] {
  const entries = getProfileLibraryEntries(profile).filter(
    (e) => e.playtimeMinutes > 0,
  );
  const seenAppIds = new Set<number>();
  const matches: LibraryCatalogMatch[] = [];

  for (const entry of entries) {
    if (matches.length >= limit) break;
    if (entry.appId > 0 && seenAppIds.has(entry.appId)) continue;
    const game = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!game) continue;
    if (entry.appId > 0) seenAppIds.add(entry.appId);

    let weight = entryPlaytimeWeight(entry);
    if (hasMeaningfulAnchorPlaytime(entry)) {
      weight *= MEANINGFUL_PLAYTIME_BOOST;
    }

    matches.push({ entry, game, weight });
  }

  if (matches.length) return matches;

  return collectAnchorLibraryCatalogMatches(profile, games, lookup, limit);
}

/** 10h+ anchors only — used when the full library has no catalog matches. */
export function collectAnchorLibraryCatalogMatches(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = LIBRARY_ENCODE_LIMIT,
): LibraryCatalogMatch[] {
  const anchors = resolveMeaningful10hAnchors(profile, limit);
  const seenAppIds = new Set<number>();
  const matches: LibraryCatalogMatch[] = [];

  if (anchors.length) {
    anchors.forEach((entry, index) => {
      if (entry.appId > 0 && seenAppIds.has(entry.appId)) return;
      const game = findCatalogGame(entry.name, entry.appId, lookup, games);
      if (!game) return;
      if (entry.appId > 0) seenAppIds.add(entry.appId);

      const recencyBoost = index === 0 ? 1.2 : 1;
      const weight =
        entryPlaytimeWeight(entry) *
        recencyMultiplier(entry.lastPlayedAt) *
        recencyBoost;

      matches.push({ entry, game, weight });
    });
    return matches;
  }

  const fallback = getProfileLibraryEntries(profile)
    .filter((e) => e.playtimeMinutes > 0)
    .slice(0, FALLBACK_LIBRARY_LIMIT);

  for (const entry of fallback) {
    if (entry.appId > 0 && seenAppIds.has(entry.appId)) continue;
    const game = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!game) continue;
    if (entry.appId > 0) seenAppIds.add(entry.appId);
    matches.push({
      entry,
      game,
      weight: entryPlaytimeWeight(entry),
    });
  }

  return matches;
}

/** @deprecated Use collectProfileQueryLibraryMatches for query vectors. */
export function collectLibraryCatalogMatches(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = LIBRARY_ENCODE_LIMIT,
): LibraryCatalogMatch[] {
  return collectProfileQueryLibraryMatches(profile, games, lookup, limit);
}

export function buildLibraryCoOccurrenceWeights(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = LIBRARY_ENCODE_LIMIT,
): Map<string, number> {
  const weights = new Map<string, number>();
  for (const match of collectProfileQueryLibraryMatches(
    profile,
    games,
    lookup,
    limit,
  )) {
    weights.set(
      match.game.id,
      (weights.get(match.game.id) ?? 0) + match.weight,
    );
  }
  return weights;
}

/** How many of the user's top-played games exist in the recommendation catalog. */
export function computeLibraryCatalogCoverage(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  sampleSize = 10,
): { matched: number; sampled: number; ratio: number } {
  const entries = getProfileLibraryEntries(profile)
    .filter((e) => e.playtimeMinutes > 0)
    .slice(0, sampleSize);

  if (!entries.length) {
    return { matched: 0, sampled: 0, ratio: 1 };
  }

  let matched = 0;
  for (const entry of entries) {
    if (findCatalogGame(entry.name, entry.appId, lookup, games)) {
      matched += 1;
    }
  }

  return {
    matched,
    sampled: entries.length,
    ratio: matched / entries.length,
  };
}

/** Weighted average of library game vectors for TF.js user encoding. */
export function encodePlayedLibraryWeightedVector(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  ctx: EmbeddingContext,
  lookup: GameLookup,
  limit = TF_LIBRARY_VECTOR_LIMIT,
): number[] | null {
  const matches = collectProfileQueryLibraryMatches(
    profile,
    games,
    lookup,
    limit,
  );
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
  const matches = collectProfileQueryLibraryMatches(
    profile,
    games,
    lookup,
    limit,
  );
  return matches.map((m) => vectorToArray(encodeGameVector(m.game, ctx)));
}

/** Genre + gameplay tags for profile encoding (genres dominate; no Steam categories). */
export function collectProfileTags(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  limit = 24,
): string[] {
  const tagWeights = new Map<string, number>();
  const matches = collectProfileQueryLibraryMatches(
    profile,
    games,
    lookup,
    LIBRARY_ENCODE_LIMIT,
  );

  for (const { game, weight } of matches) {
    for (const genre of collectGameGenres(game)) {
      tagWeights.set(genre, (tagWeights.get(genre) ?? 0) + weight * 1.4);
    }
    for (const tag of collectGameplayTags(game)) {
      tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + weight * 0.35);
    }
  }

  for (const genre of profile.inferredGenres) {
    const g = normMetadataToken(genre);
    if (g) tagWeights.set(g, (tagWeights.get(g) ?? 0) + 1.0);
  }

  for (const tag of profile.steamTags ?? []) {
    const n = normMetadataToken(tag);
    if (!n || isSteamCategory(n)) continue;
    tagWeights.set(n, (tagWeights.get(n) ?? 0) + 0.4);
  }

  for (const entry of resolveMeaningful10hAnchors(profile, 5)) {
    const anchorGame = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!anchorGame) continue;
    for (const genre of collectGameGenres(anchorGame)) {
      tagWeights.set(genre, (tagWeights.get(genre) ?? 0) + 3.5);
    }
    for (const tag of collectGameplayTags(anchorGame)) {
      tagWeights.set(tag, (tagWeights.get(tag) ?? 0) + 0.8);
    }
  }

  return [...tagWeights.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([tag]) => tag);
}
