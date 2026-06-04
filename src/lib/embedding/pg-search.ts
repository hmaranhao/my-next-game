import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric, ScoredCandidate } from "@/types/embedding";
import { prisma } from "@/lib/prisma";
import { encodeGameVector, encodeProfileVectorFromLibrary } from "./encode";
import { scoreVectors } from "./distance";
import { getCandidateTopK } from "./config";
import { blendRankScore } from "./popularity";
import { loadActiveEmbeddingCatalog } from "./catalog";
import {
  collectLibraryCatalogMatches,
  collectProfileTags,
} from "./played-games";
import { buildGameLookup } from "@/lib/game-lookup";
import { applySearchWeights, toPgVectorLiteral } from "./vector-utils";
import {
  buildPlayedAppIdSet,
  buildPlayedNameSet,
  finalizeCandidatesFromDrafts,
  isGameAlreadyPlayed,
  type ScoredDraft,
} from "./search";

type PgRow = {
  gameExternalId: string;
  gameMetadata: NormalizedGame;
  popularityScore: number;
  distance: number;
};

export async function findTopGameCandidatesPg(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  metric: DistanceMetric,
): Promise<{
  queryVector: Float32Array;
  candidates: ScoredCandidate[];
  contextMeta: import("./context").EmbeddingContext;
  profileTags: string[];
  topK: number;
  scoredCount: number;
  searchBackend: "pg";
} | null> {
  try {
  const catalog = await loadActiveEmbeddingCatalog();
  if (!catalog || catalog.gameCount === 0) return null;

  const ctx = catalog.context;
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
  const excludeIds = [...playedAppIds].map(String);

  const topK = getCandidateTopK();
  const fetchLimit = Math.min(topK * 5, 2000);
  const searchVec = applySearchWeights(queryVector);
  const vecLit = toPgVectorLiteral(searchVec);

  const distanceExpr =
    metric === "l2"
      ? `"searchEmbedding" <-> '${vecLit}'::vector`
      : `"searchEmbedding" <=> '${vecLit}'::vector`;

  const rows =
    excludeIds.length > 0
      ? await prisma.$queryRawUnsafe<PgRow[]>(
          `SELECT
            e."gameExternalId",
            e."gameMetadata",
            e."popularityScore",
            (e.${distanceExpr}) AS distance
          FROM game_catalog_entries e
          WHERE e."catalogId" = $1
            AND e."gameExternalId" != ALL($2::text[])
          ORDER BY e.${distanceExpr}
          LIMIT $3`,
          catalog.id,
          excludeIds,
          fetchLimit,
        )
      : await prisma.$queryRawUnsafe<PgRow[]>(
          `SELECT
            e."gameExternalId",
            e."gameMetadata",
            e."popularityScore",
            (e.${distanceExpr}) AS distance
          FROM game_catalog_entries e
          WHERE e."catalogId" = $1
          ORDER BY e.${distanceExpr}
          LIMIT $2`,
          catalog.id,
          fetchLimit,
        );

  const drafts: ScoredDraft[] = [];

  for (const row of rows) {
    const game = row.gameMetadata as NormalizedGame;
    if (isGameAlreadyPlayed(game, playedNames, playedAppIds)) continue;

    const gameVector = encodeGameVector(game, ctx);
    const { score: vectorScore, distance } = scoreVectors(
      queryVector,
      gameVector,
      metric,
    );
    const popularity = row.popularityScore;
    const rankScore = blendRankScore(vectorScore, popularity);

    drafts.push({
      gameId: row.gameExternalId,
      game,
      gameVector,
      vectorScore,
      popularityScore: popularity,
      score: rankScore,
      distance,
    });

    if (drafts.length >= topK * 2) break;
  }

  drafts.sort((a, b) => b.score - a.score);
  const candidates = finalizeCandidatesFromDrafts(
    drafts.slice(0, topK),
    queryVector,
  );

  return {
    queryVector,
    candidates,
    contextMeta: ctx,
    profileTags,
    topK,
    scoredCount: catalog.gameCount,
    searchBackend: "pg",
  };
  } catch {
    return null;
  }
}
