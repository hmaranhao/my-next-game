import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric, ScoredCandidate } from "@/types/embedding";
import { buildEmbeddingContext } from "./context";
import {
  encodeGameVector,
  encodeProfileVectorFromLibrary,
} from "./encode";
import { scoreVectors } from "./distance";
import { getCandidateTopK } from "./config";
import { blendRankScore, getGamePopularity } from "./popularity";
import {
  collectLibraryCatalogMatches,
  collectProfileTags,
} from "./played-games";
import { buildGameLookup } from "@/lib/game-lookup";

export function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\breview\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function buildPlayedAppIdSet(profile: NormalizedUserProfile): Set<number> {
  const ids = new Set<number>();
  for (const id of profile.playedAppIds) {
    if (id > 0) ids.add(id);
  }
  for (const g of profile.topGames) {
    if (g.appId > 0) ids.add(g.appId);
  }
  for (const g of profile.libraryGames ?? []) {
    if (g.appId > 0) ids.add(g.appId);
  }
  return ids;
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
  playedAppIds: Set<number>,
): boolean {
  if (game.steamAppId != null && playedAppIds.has(game.steamAppId)) {
    return true;
  }
  const parsedId = Number.parseInt(game.id, 10);
  if (Number.isFinite(parsedId) && playedAppIds.has(parsedId)) {
    return true;
  }

  const n = normalizeGameName(game.name);
  if (playedNames.has(n)) return true;
  for (const played of playedNames) {
    if (played.length > 4 && (n.includes(played) || played.includes(n))) {
      return true;
    }
  }
  return false;
}

type ScoredDraft = {
  gameId: string;
  game: NormalizedGame;
  gameVector: Float32Array;
  vectorScore: number;
  popularityScore: number;
  score: number;
  distance: number;
};

/** Keep only the best `limit` items — O(n·k) memory instead of O(n). */
function pushTopK(heap: ScoredDraft[], entry: ScoredDraft, limit: number): void {
  if (heap.length < limit) {
    heap.push(entry);
    if (heap.length === limit) {
      heap.sort((a, b) => a.score - b.score);
    }
    return;
  }
  if (entry.score > heap[0].score) {
    heap[0] = entry;
    heap.sort((a, b) => a.score - b.score);
  }
}

function finalizeCandidates(
  drafts: ScoredDraft[],
  queryVector: Float32Array,
): ScoredCandidate[] {
  return drafts
    .sort((a, b) => b.score - a.score)
    .map((d) => {
      const combinedVector = new Float32Array(queryVector.length);
      for (let i = 0; i < queryVector.length; i++) {
        combinedVector[i] = (queryVector[i] + d.gameVector[i]) / 2;
      }
      return {
        gameId: d.gameId,
        game: d.game,
        vector: combinedVector,
        gameVector: d.gameVector,
        vectorScore: d.vectorScore,
        popularityScore: d.popularityScore,
        score: d.score,
        distance: d.distance,
      };
    });
}

export function findTopGameCandidates(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  metric: DistanceMetric,
): {
  queryVector: Float32Array;
  candidates: ScoredCandidate[];
  contextMeta: ReturnType<typeof buildEmbeddingContext>;
  profileTags: string[];
  topK: number;
  scoredCount: number;
} {
  const ctx = buildEmbeddingContext(games);
  const lookup = buildGameLookup(games);
  const libraryMatches = collectLibraryCatalogMatches(profile, games, lookup);
  const profileTags = collectProfileTags(profile, games, lookup);
  const queryVector = encodeProfileVectorFromLibrary(
    profile,
    ctx,
    libraryMatches,
    profileTags,
  );
  const playedNames = buildPlayedNameSet(profile);
  const playedAppIds = buildPlayedAppIdSet(profile);

  const topK = getCandidateTopK();
  const heap: ScoredDraft[] = [];
  let scoredCount = 0;

  for (const game of games) {
    if (isGameAlreadyPlayed(game, playedNames, playedAppIds)) continue;

    const gameVector = encodeGameVector(game, ctx);
    const { score: vectorScore, distance } = scoreVectors(
      queryVector,
      gameVector,
      metric,
    );
    const popularity = getGamePopularity(game);
    const rankScore = blendRankScore(vectorScore, popularity);

    pushTopK(
      heap,
      {
        gameId: game.id,
        game,
        gameVector,
        vectorScore,
        popularityScore: popularity,
        score: rankScore,
        distance,
      },
      topK,
    );
    scoredCount += 1;
  }

  const candidates = finalizeCandidates(heap, queryVector);

  return { queryVector, candidates, contextMeta: ctx, profileTags, topK, scoredCount };
}
