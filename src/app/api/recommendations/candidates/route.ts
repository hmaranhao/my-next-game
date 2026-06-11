import { NextResponse } from "next/server";
import { loadGamesDataset } from "@/lib/game-data";
import { getFinalPickTopN, getApiResponseTopN, getPersistTopN } from "@/lib/embedding/config";
import { getDistanceMetric } from "@/lib/embedding/distance";
import { findTopGameCandidatesAsync } from "@/lib/embedding/search-service";
import {
  loadProfileSnapshot,
  persistCandidateSession,
} from "@/lib/embedding/persist-candidates";
import { vectorToArray } from "@/lib/embedding/encode";
import { buildEmbeddingContext } from "@/lib/embedding/context";
import { encodePlayedLibraryWeightedVector } from "@/lib/embedding/played-games";
import { buildGameLookup } from "@/lib/game-lookup";
import {
  resolveAnchorCatalogGames,
  resolveMeaningful10hAnchors,
} from "@/lib/embedding/last-played";
import { classifyGameTier } from "@/lib/embedding/game-tier";
import type { CandidateSearchResult } from "@/types/embedding";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const started = Date.now();
  try {
    const body = (await request.json()) as {
      snapshotId?: string;
      metric?: "cosine" | "l2";
      excludeGameIds?: string[];
      ignoreFeedback?: boolean;
    };

    if (!body.snapshotId) {
      return NextResponse.json(
        { ok: false, message: "snapshotId is required" },
        { status: 400 },
      );
    }

    const snapshot = await loadProfileSnapshot(body.snapshotId);
    if (!snapshot) {
      return NextResponse.json(
        { ok: false, message: "Profile snapshot not found" },
        { status: 404 },
      );
    }

    const extraRejectIds = (body.excludeGameIds ?? [])
      .map((id) => String(id).trim())
      .filter(Boolean);

    const metric = body.metric ?? getDistanceMetric();
    const { games } = await loadGamesDataset();
    const {
      queryVector,
      candidates,
      contextMeta,
      profileTags,
      scoredCount,
      searchBackend,
      rejectedGameIds,
    } = await findTopGameCandidatesAsync(
      snapshot.profile,
      games,
      metric,
      snapshot.id,
      extraRejectIds,
      { ignoreFeedback: body.ignoreFeedback === true },
    );
    const ctx = buildEmbeddingContext(games);
    const lookup = buildGameLookup(games);
    const anchorCatalogGames = resolveAnchorCatalogGames(
      snapshot.profile,
      games,
      lookup,
    );
    const anchorEntries = resolveMeaningful10hAnchors(snapshot.profile, 5);
    const anchorTier = anchorCatalogGames[0]
      ? classifyGameTier(anchorCatalogGames[0])
      : null;
    const playedGameWeightedVector = encodePlayedLibraryWeightedVector(
      snapshot.profile,
      games,
      ctx,
      lookup,
    );

    const persistN = getPersistTopN();
    const responseN = getApiResponseTopN();
    const toPersist = candidates.slice(0, persistN);
    const toRespond = candidates.slice(0, responseN);

    const sessionId = await persistCandidateSession(snapshot.id, toPersist);

    const result: CandidateSearchResult = {
      sessionId,
      metric,
      queryVector: vectorToArray(queryVector),
      candidates: toRespond.map((c, idx) => ({
        rank: idx + 1,
        gameId: c.gameId,
        name: c.game.name,
        genre: c.game.genre,
        platform: c.game.platform,
        rating: c.game.rating,
        score: Math.round(c.score * 1000) / 1000,
        vectorScore: Math.round(c.vectorScore * 1000) / 1000,
        popularityScore: Math.round(c.popularityScore * 1000) / 1000,
        anchorAffinity: Math.round((c.anchorAffinity ?? 0) * 1000) / 1000,
        distance: Math.round(c.distance * 1000) / 1000,
        gameVector: vectorToArray(c.gameVector),
        metadata: c.game,
      })),
      elapsedMs: Date.now() - started,
    };

    return NextResponse.json({
      ok: true,
      ...result,
      playedGameWeightedVector,
      catalogGameCount: games.length,
      candidatePoolSize: scoredCount,
      rankedCandidateCount: candidates.length,
      searchBackend,
      useSampleCatalog: process.env.USE_SAMPLE_GAME_DATA === "true",
      finalPickTopN: getFinalPickTopN(),
      rejectedGameIds,
      profileTags,
      anchorTier,
      anchorGames: anchorEntries.slice(0, 3).map((entry, i) => ({
        name: entry.name,
        playtimeHours: entry.playtimeHours,
        tier: anchorCatalogGames[i]
          ? classifyGameTier(anchorCatalogGames[i])
          : null,
      })),
      embedding: {
        dimension: contextMeta.dimension,
        layout: "128-dim shared genre/platform/tag/publisher + continuous",
        vocabSizes: {
          genres: contextMeta.genres.length,
          platforms: contextMeta.platforms.length,
          tags: contextMeta.tags.length,
          publishers: contextMeta.publishers.length,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
