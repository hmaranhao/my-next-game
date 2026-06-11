import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric } from "@/types/embedding";
import type { EmbeddingContext } from "./context";
import { encodeGameVector } from "./encode";
import { scoreVectors } from "./distance";
import { findCatalogGame, type GameLookup } from "@/lib/game-lookup";
import {
  collectAnchorGenres,
  collectGameGenres,
  computeGameplayTagOverlap,
  computeGenreOverlapScore,
} from "./steam-metadata-utils";
import {
  resolveLastPlayedEntry,
  resolveMeaningful10hAnchors,
} from "./played-games";

export function resolveLastPlayedCatalogGame(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
): NormalizedGame | null {
  const anchors = resolveAnchorCatalogGames(profile, games, lookup);
  return anchors[0] ?? null;
}

export function resolveAnchorCatalogGames(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
): NormalizedGame[] {
  const entries = resolveMeaningful10hAnchors(profile, 5);
  const catalogGames: NormalizedGame[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    const game = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!game || seen.has(game.id)) continue;
    seen.add(game.id);
    catalogGames.push(game);
  }

  return catalogGames;
}

/** Genre overlap between two catalog games (Steam genres only). */
export function computeGameToGameGenreOverlap(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  return computeGenreOverlapScore(
    new Set(collectGameGenres(anchor)),
    collectGameGenres(candidate),
  );
}

/** @deprecated Use computeGameToGameGenreOverlap — kept for tests/scripts. */
export function computeGameToGameOverlap(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  return computeGameToGameGenreOverlap(anchor, candidate);
}

/** How similar a candidate is to a 10h+ anchor (genre-first). */
export function computeLastPlayedAffinity(
  candidate: NormalizedGame,
  lastPlayed: NormalizedGame,
  ctx: EmbeddingContext,
  metric: DistanceMetric,
): number {
  const lastVec = encodeGameVector(lastPlayed, ctx);
  const candVec = encodeGameVector(candidate, ctx);
  const { score: vectorSim } = scoreVectors(lastVec, candVec, metric);
  const genreOverlap = computeGameToGameGenreOverlap(lastPlayed, candidate);
  const tagOverlap = computeGameplayTagOverlap(lastPlayed, candidate);

  if (genreOverlap === 0) {
    return Math.min(1, vectorSim * 0.15 + tagOverlap * 0.1);
  }

  return Math.min(1, vectorSim * 0.2 + genreOverlap * 0.7 + tagOverlap * 0.1);
}

/** Best affinity across multiple 10h+ anchors (recent anchors weighted higher). */
export function computeMultiAnchorAffinity(
  candidate: NormalizedGame,
  anchors: NormalizedGame[],
  ctx: EmbeddingContext,
  metric: DistanceMetric,
): number {
  if (!anchors.length) return 0;

  const anchorGenres = collectAnchorGenres(anchors);
  const genreOverlap = computeGenreOverlapScore(
    anchorGenres,
    collectGameGenres(candidate),
  );

  let best = 0;
  anchors.forEach((anchor, index) => {
    const affinity = computeLastPlayedAffinity(candidate, anchor, ctx, metric);
    const recencyBoost = index === 0 ? 1.2 : 1;
    best = Math.max(best, Math.min(1, affinity * recencyBoost));
  });

  if (genreOverlap === 0) {
    return best * 0.35;
  }

  return Math.max(best, Math.min(1, genreOverlap * 0.85 + best * 0.15));
}

export {
  resolveLastPlayedEntry,
  resolveMeaningful10hAnchors,
} from "./played-games";
