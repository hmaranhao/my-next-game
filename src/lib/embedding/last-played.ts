import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric } from "@/types/embedding";
import type { EmbeddingContext } from "./context";
import { encodeGameVector } from "./encode";
import { scoreVectors } from "./distance";
import { splitGenreTokens } from "./genre-utils";
import { findCatalogGame, type GameLookup } from "@/lib/game-lookup";
import { resolveLastPlayedEntry } from "./played-games";

export function resolveLastPlayedCatalogGame(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
): NormalizedGame | null {
  const entry = resolveLastPlayedEntry(profile);
  if (!entry) return null;
  return findCatalogGame(entry.name, entry.appId, lookup, games);
}

function normTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Tag/genre overlap between two catalog games. */
export function computeGameToGameOverlap(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  const anchorTags = new Set<string>();
  for (const tag of anchor.tags) anchorTags.add(normTag(tag));
  for (const g of splitGenreTokens(anchor.genre)) anchorTags.add(normTag(g));

  const candidateTags = new Set<string>();
  for (const tag of candidate.tags) candidateTags.add(normTag(tag));
  for (const g of splitGenreTokens(candidate.genre)) candidateTags.add(normTag(g));

  if (!anchorTags.size || !candidateTags.size) return 0;

  let shared = 0;
  for (const t of candidateTags) {
    if (anchorTags.has(t)) shared += 1;
  }

  return Math.min(1, shared / Math.max(2, Math.min(anchorTags.size, 10) * 0.45));
}

/** How similar a candidate is to what the player just played (vector + tags). */
export function computeLastPlayedAffinity(
  candidate: NormalizedGame,
  lastPlayed: NormalizedGame,
  ctx: EmbeddingContext,
  metric: DistanceMetric,
): number {
  const lastVec = encodeGameVector(lastPlayed, ctx);
  const candVec = encodeGameVector(candidate, ctx);
  const { score: vectorSim } = scoreVectors(lastVec, candVec, metric);
  const tagOverlap = computeGameToGameOverlap(lastPlayed, candidate);
  return Math.min(1, vectorSim * 0.5 + tagOverlap * 0.5);
}

export { resolveLastPlayedEntry } from "./played-games";
