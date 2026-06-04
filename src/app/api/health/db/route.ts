import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loadActiveEmbeddingCatalog } from "@/lib/embedding/catalog";
import { getVectorSearchBackend } from "@/lib/embedding/config";

export async function GET() {
  try {
    const [db] = await prisma.$queryRaw<[{ ok: number }]>`
      SELECT 1::int AS ok
    `;
    const [ext] = await prisma.$queryRaw<[{ extname: string }]>`
      SELECT extname::text AS extname FROM pg_extension WHERE extname = 'vector' LIMIT 1
    `;

    let catalog: Awaited<ReturnType<typeof loadActiveEmbeddingCatalog>> = null;
    try {
      catalog = await loadActiveEmbeddingCatalog();
    } catch {
      catalog = null;
    }

    return NextResponse.json({
      status: "ok",
      database: db?.ok === 1,
      pgvector: ext?.extname === "vector",
      vectorSearchBackend: getVectorSearchBackend(),
      embeddingCatalog: catalog
        ? {
            id: catalog.id,
            label: catalog.label,
            gameCount: catalog.gameCount,
          }
        : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { status: "error", message },
      { status: 503 },
    );
  }
}
