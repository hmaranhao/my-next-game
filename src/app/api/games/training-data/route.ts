import { NextResponse } from "next/server";
import { loadGamesDataset } from "@/lib/game-data";
import { buildEmbeddingContext } from "@/lib/embedding/context";
import { encodeGameVector, vectorToArray } from "@/lib/embedding/encode";

const MAX_PAIRS = 5000;

export async function GET() {
  try {
    const { games, pairs } = await loadGamesDataset();
    const ctx = buildEmbeddingContext(games);
    const gameById = new Map(games.map((g) => [g.id, g]));

    const limitedPairs = pairs.slice(0, MAX_PAIRS);
    const neededIds = new Set<string>();
    for (const p of limitedPairs) {
      neededIds.add(p.sourceGameId);
      neededIds.add(p.targetGameId);
    }

    const gameVectors: Record<string, number[]> = {};
    for (const id of neededIds) {
      const game = gameById.get(id);
      if (!game) continue;
      gameVectors[id] = vectorToArray(encodeGameVector(game, ctx));
    }

    return NextResponse.json({
      ok: true,
      pairs: limitedPairs,
      gameVectors,
      dimension: ctx.dimension,
      pairCount: limitedPairs.length,
      gameCount: Object.keys(gameVectors).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
