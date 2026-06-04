import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric, ScoredCandidate } from "@/types/embedding";
import { prisma } from "@/lib/prisma";
import { encodeGameVector, encodeProfileVectorFromLibrary } from "./encode";
import { scoreVectors } from "./distance";
import { getCandidateTopK, getFinalPickTopN } from "./config";
import { scoreCandidateForRanking } from "./candidate-ranking";
import { resolveLastPlayedCatalogGame } from "./last-played";
import { loadActiveEmbeddingCatalog } from "./catalog";
import {
  collectLibraryCatalogMatches,
  collectProfileTags,
} from "./played-games";
import { buildGameLookup, enrichCatalogGame } from "@/lib/game-lookup";
import { applySearchWeights, toPgVectorLiteral } from "./vector-utils";
import {
  buildPlayedAppIdSet,
  buildPlayedNameSet,
  finalizeCandidatesFromDrafts,
  isGameAlreadyPlayed,
  type ScoredDraft,
} from "./search";
import type { StoredFeedback } from "./taste-signals";
import {
  buildTasteSignals,
  mergeRejectedGameIds,
} from "./taste-signals";
import type { SocialProofFloorMode } from "./social-proof";

type PgRow = {
  gameExternalId: string;
  gameMetadata: NormalizedGame;
  popularityScore: number;
  distance: number;
};

const FLOOR_MODES: SocialProofFloorMode[] = ["strict", "relaxed", "emergency"];

export async function findTopGameCandidatesPg(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  metric: DistanceMetric,
  feedback: StoredFeedback[] = [],
  extraRejectIds: string[] = [],
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
    const taste = buildTasteSignals(profile, games, lookup, feedback);
    const rejectedIds = [...mergeRejectedGameIds(feedback, extraRejectIds)];
    const lastPlayedCatalogGame = resolveLastPlayedCatalogGame(
      profile,
      games,
      lookup,
    );
    const rankingCtx = {
      profile,
      profileTags,
      taste,
      embeddingCtx: ctx,
      metric,
      lastPlayedCatalogGame,
    };
    const playedExcludeIds = [...new Set([...playedAppIds].map(String))];

    const topK = getCandidateTopK();
    const minCandidates = Math.min(getFinalPickTopN(), topK);
    const fetchLimit = Math.min(topK * 30, 5000);
    const searchVec = applySearchWeights(queryVector);
    const vecLit = toPgVectorLiteral(searchVec);

    const distanceExpr =
      metric === "l2"
        ? `"searchEmbedding" <-> '${vecLit}'::vector`
        : `"searchEmbedding" <=> '${vecLit}'::vector`;

    const vectorRows =
      playedExcludeIds.length > 0
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
            playedExcludeIds,
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
    const seenIds = new Set<string>();

    function tryScoreRow(
      row: PgRow,
      floor: SocialProofFloorMode,
    ): ScoredDraft | null {
      const game = enrichCatalogGame(row.gameMetadata as NormalizedGame, lookup);
      if (rejectedIds.includes(row.gameExternalId)) return null;
      if (seenIds.has(row.gameExternalId)) return null;
      if (isGameAlreadyPlayed(game, playedNames, playedAppIds)) return null;

      const gameVector = encodeGameVector(game, ctx);
      const { score: vectorScore, distance } = scoreVectors(
        queryVector,
        gameVector,
        metric,
      );
      const scored = scoreCandidateForRanking(game, vectorScore, rankingCtx, {
        floor,
      });
      if (!scored) return null;

      seenIds.add(row.gameExternalId);
      return {
        gameId: row.gameExternalId,
        game,
        gameVector,
        vectorScore,
        popularityScore: scored.popularityScore,
        score: scored.rankScore,
        distance,
      };
    }

    function scoreRowsWithFloors(rows: PgRow[]) {
      for (const mode of FLOOR_MODES) {
        if (drafts.length >= topK) break;
        for (const row of rows) {
          if (drafts.length >= topK) break;
          const draft = tryScoreRow(row, mode);
          if (draft) drafts.push(draft);
        }
      }
    }

    scoreRowsWithFloors(vectorRows);

    if (drafts.length < minCandidates) {
      const popularRows =
        playedExcludeIds.length > 0
          ? await prisma.$queryRawUnsafe<PgRow[]>(
              `SELECT
              e."gameExternalId",
              e."gameMetadata",
              e."popularityScore",
              1.0 AS distance
            FROM game_catalog_entries e
            WHERE e."catalogId" = $1
              AND e."gameExternalId" != ALL($2::text[])
            ORDER BY e."popularityScore" DESC NULLS LAST
            LIMIT $3`,
              catalog.id,
              playedExcludeIds,
              1200,
            )
          : await prisma.$queryRawUnsafe<PgRow[]>(
              `SELECT
              e."gameExternalId",
              e."gameMetadata",
              e."popularityScore",
              1.0 AS distance
            FROM game_catalog_entries e
            WHERE e."catalogId" = $1
            ORDER BY e."popularityScore" DESC NULLS LAST
            LIMIT $2`,
              catalog.id,
              1200,
            );

      scoreRowsWithFloors(popularRows);
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
