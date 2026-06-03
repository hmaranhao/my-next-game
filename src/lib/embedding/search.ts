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

  const scored: ScoredCandidate[] = [];

  for (const game of games) {
    if (isGameAlreadyPlayed(game, playedNames, playedAppIds)) continue;

    const gameVector = encodeGameVector(game, ctx);
    const { score: vectorScore, distance } = scoreVectors(queryVector, gameVector, metric);
    const popularity = getGamePopularity(game);
    const rankScore = blendRankScore(vectorScore, popularity);
    const combinedVector = new Float32Array(queryVector.length);
    for (let i = 0; i < queryVector.length; i++) {
      combinedVector[i] = (queryVector[i] + gameVector[i]) / 2;
    }

    scored.push({
      gameId: game.id,
      game,
      vector: combinedVector,
      gameVector,
      vectorScore,
      popularityScore: popularity,
      score: rankScore,
      distance,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topK = getCandidateTopK();
  const candidates = scored.slice(0, topK);

  return { queryVector, candidates, contextMeta: ctx, profileTags, topK };
}
