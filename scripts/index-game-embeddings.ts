/**
 * Index game catalog into Postgres for pgvector KNN search.
 *
 * Usage:
 *   npm run data:download          # ~122k jogos
 *   npm run db:migrate
 *   npm run db:index-embeddings    # indexa TUDO em games.normalized.json
 *
 * Env:
 *   DATABASE_URL — Postgres with pgvector (Neon em produção)
 *   INDEX_GAME_LIMIT — cap opcional (ex.: 5000 para teste). Default: sem limite.
 *   INDEX_SOURCE — normalized | cloud | sample (default: normalized)
 *   INDEX_REPLACE — delete all catalogs before index (default: true)
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { NormalizedGame } from "../src/types/game";
import {
  buildEmbeddingContext,
  embeddingContextToStored,
} from "../src/lib/embedding/context";
import { encodeGameVector } from "../src/lib/embedding/encode";
import { applySearchWeights, toPgVectorLiteral } from "../src/lib/embedding/vector-utils";
import { getGamePopularity } from "../src/lib/embedding/popularity";
import { activateEmbeddingCatalog } from "../src/lib/embedding/catalog";
import { jsonSafeStringify } from "../src/lib/json-safe";
import {
  NEON_FREE_TIER_GAME_CAP,
  slimGameForIndex,
} from "../src/lib/game-metadata-slim";

const INSERT_BATCH = 200;
const root = process.cwd();

type IndexSource = "normalized" | "cloud" | "sample";

function resolveSource(): IndexSource {
  const raw = (process.env.INDEX_SOURCE ?? "normalized").toLowerCase();
  if (raw === "cloud" || raw === "sample" || raw === "normalized") return raw;
  return "normalized";
}

function loadGames(): NormalizedGame[] {
  const source = resolveSource();
  const fullPath = path.join(root, "data/games.normalized.json");
  const cloudPath = path.join(root, "data/games.cloud.json");
  const samplePath = path.join(root, "data/samples/games.sample.json");

  let games: NormalizedGame[];

  if (source === "sample") {
    if (!fs.existsSync(samplePath)) {
      throw new Error("Missing data/samples/games.sample.json");
    }
    games = JSON.parse(fs.readFileSync(samplePath, "utf-8")) as NormalizedGame[];
    console.log(`Source: sample (${games.length} games)`);
  } else if (source === "cloud") {
    if (!fs.existsSync(cloudPath)) {
      throw new Error("Missing data/games.cloud.json — run npm run data:cloud");
    }
    games = JSON.parse(fs.readFileSync(cloudPath, "utf-8")) as NormalizedGame[];
    console.log(`Source: cloud (${games.length} games)`);
  } else {
    if (!fs.existsSync(fullPath)) {
      throw new Error("Missing data/games.normalized.json — run npm run data:download");
    }
    console.log("Loading data/games.normalized.json…");
    games = JSON.parse(fs.readFileSync(fullPath, "utf-8")) as NormalizedGame[];
    console.log(`Source: normalized (${games.length} games)`);
  }

  const limitRaw = process.env.INDEX_GAME_LIMIT;
  if (limitRaw) {
    const limit = Number.parseInt(limitRaw, 10);
    if (Number.isFinite(limit) && limit > 0 && limit < games.length) {
      games = [...games]
        .sort((a, b) => getGamePopularity(b) - getGamePopularity(a))
        .slice(0, limit);
      console.log(`INDEX_GAME_LIMIT: using top ${limit} by popularity`);
    }
  }

  return games;
}

type PreparedRow = {
  id: string;
  gameId: string;
  metadata: string;
  vecLit: string;
  popularity: number;
};

async function insertBatch(
  prisma: PrismaClient,
  catalogId: string,
  rows: PreparedRow[],
): Promise<void> {
  if (!rows.length) return;

  const parts: string[] = [];
  const params: unknown[] = [];
  let n = 1;

  for (const row of rows) {
    parts.push(
      `($${n}, $${n + 1}, $${n + 2}, $${n + 3}::jsonb, $${n + 4}::vector, $${n + 5}, NOW())`,
    );
    params.push(row.id, catalogId, row.gameId, row.metadata, row.vecLit, row.popularity);
    n += 6;
  }

  await prisma.$executeRawUnsafe(
    `INSERT INTO game_catalog_entries
      (id, "catalogId", "gameExternalId", "gameMetadata", "searchEmbedding", "popularityScore", "createdAt")
     VALUES ${parts.join(", ")}`,
    ...params,
  );
}

async function replaceExistingCatalogs(prisma: PrismaClient): Promise<number> {
  const removed = await prisma.embeddingCatalog.deleteMany({});
  return removed.count;
}

function shouldReplaceCatalogs(): boolean {
  const raw = (process.env.INDEX_REPLACE ?? "true").toLowerCase();
  return raw !== "false" && raw !== "0";
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const games = loadGames();
  if (!games.length) {
    throw new Error("Empty game list");
  }

  if (
    games.length > NEON_FREE_TIER_GAME_CAP &&
    !process.env.INDEX_GAME_LIMIT &&
    process.env.DATABASE_URL?.includes("neon.tech")
  ) {
    console.warn(
      `\n⚠ Neon free tier (~512 MB): ${games.length} jogos pode estourar o limite.`,
    );
    console.warn(
      `  Use INDEX_GAME_LIMIT=${NEON_FREE_TIER_GAME_CAP} ou faça upgrade do plano Neon.\n`,
    );
  }

  if (shouldReplaceCatalogs()) {
    const removed = await replaceExistingCatalogs(prisma);
    if (removed > 0) {
      console.log(`Removed ${removed} existing catalog(s) (INDEX_REPLACE).`);
    }
  } else {
    const inactive = await prisma.embeddingCatalog.deleteMany({
      where: { isActive: false },
    });
    if (inactive.count > 0) {
      console.log(`Removed ${inactive.count} inactive catalog(s).`);
    }
  }

  console.log("Building embedding vocabulary…");
  const ctx = buildEmbeddingContext(games);
  const stored = embeddingContextToStored(ctx);
  const label =
    process.env.CATALOG_LABEL ??
    `full-${games.length}-${new Date().toISOString().slice(0, 10)}`;
  const catalogId = randomUUID();

  console.log(`Creating catalog "${label}" with ${games.length} games…`);

  await prisma.embeddingCatalog.create({
    data: {
      id: catalogId,
      label,
      contextMeta: stored,
      gameCount: games.length,
      isActive: false,
    },
  });

  let inserted = 0;
  const started = Date.now();

  try {
    let pending: PreparedRow[] = [];

    for (const game of games) {
      const rawVec = encodeGameVector(game, ctx);
      const searchVec = applySearchWeights(rawVec);
      pending.push({
        id: randomUUID(),
        gameId: game.id,
        metadata: jsonSafeStringify(slimGameForIndex(game)),
        vecLit: toPgVectorLiteral(searchVec),
        popularity: getGamePopularity(game),
      });

      if (pending.length >= INSERT_BATCH) {
        await insertBatch(prisma, catalogId, pending);
        inserted += pending.length;
        pending = [];
        if (inserted % 2000 === 0 || inserted === games.length) {
          const elapsed = ((Date.now() - started) / 1000).toFixed(1);
          console.log(`  ${inserted}/${games.length} (${elapsed}s)`);
        }
      }
    }

    if (pending.length) {
      await insertBatch(prisma, catalogId, pending);
      inserted += pending.length;
    }

    console.log("Activating catalog…");
    await activateEmbeddingCatalog(catalogId);
  } catch (err) {
    await prisma.embeddingCatalog.delete({ where: { id: catalogId } }).catch(() => {});
    throw err;
  }

  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\nDone in ${elapsed}s. Active catalog ${catalogId} — ${inserted} games indexed.`);
  console.log("Production: VECTOR_SEARCH_BACKEND=auto uses pgvector when this DB is connected.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
