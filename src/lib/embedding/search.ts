import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric, ScoredCandidate } from "@/types/embedding";
import { buildEmbeddingContext } from "./context";
import {
  encodeGameVector,
  encodeProfileGameVector,
  encodeProfileVector,
} from "./encode";
import { scoreVectors } from "./distance";

const TOP_K = 50;

export function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\breview\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildPlayedNameSet(profile: NormalizedUserProfile): Set<string> {
  const names = new Set<string>();
  for (const n of profile.playedGameNames) {
    names.add(normalizeGameName(n));
  }
  for (const g of profile.topGames) {
    if (g.playtimeMinutes > 0) {
      names.add(normalizeGameName(g.name));
    }
  }
  for (const g of profile.recentGames) {
    names.add(normalizeGameName(g.name));
  }
  return names;
}

export function isGameAlreadyPlayed(
  game: NormalizedGame,
  playedNames: Set<string>,
): boolean {
  const n = normalizeGameName(game.name);
  if (playedNames.has(n)) return true;
  for (const played of playedNames) {
    if (played.length > 4 && (n.includes(played) || played.includes(n))) {
      return true;
    }
  }
  return false;
}

export function findTopGameCandidates(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  metric: DistanceMetric,
): {
  queryVector: Float32Array;
  candidates: ScoredCandidate[];
  contextMeta: ReturnType<typeof buildEmbeddingContext>;
} {
  const ctx = buildEmbeddingContext(games);
  const queryVector = encodeProfileVector(profile, ctx);
  const playedNames = buildPlayedNameSet(profile);

  const scored: ScoredCandidate[] = [];

  for (const game of games) {
    if (isGameAlreadyPlayed(game, playedNames)) continue;

    const gameVector = encodeGameVector(game, ctx);
    const { score, distance } = scoreVectors(queryVector, gameVector, metric);
    const combinedVector = encodeProfileGameVector(profile, game, ctx);

    scored.push({
      gameId: game.id,
      game,
      vector: combinedVector,
      score,
      distance,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, TOP_K);

  return { queryVector, candidates, contextMeta: ctx };
}
