import { prisma } from "@/lib/prisma";
import {
  embeddingContextFromStored,
  type EmbeddingContext,
} from "./context";

export type ActiveCatalog = {
  id: string;
  label: string;
  gameCount: number;
  context: EmbeddingContext;
};

function isMissingCatalogTableError(error: unknown): boolean {
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: string }).code;
    if (code === "P2021" || code === "42P01") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("game_catalog_entries") ||
    message.includes("embedding_catalogs") ||
    message.includes("does not exist")
  );
}

export async function getActiveCatalogEntryCount(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM game_catalog_entries e
      INNER JOIN embedding_catalogs c ON c.id = e."catalogId"
      WHERE c."isActive" = true
    `;
    return Number(rows[0]?.count ?? 0);
  } catch (error) {
    if (isMissingCatalogTableError(error)) return 0;
    throw error;
  }
}

export async function loadActiveEmbeddingCatalog(): Promise<ActiveCatalog | null> {
  try {
    const catalog = await prisma.embeddingCatalog.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "desc" },
    });
    if (!catalog) return null;

    const stored = catalog.contextMeta as Parameters<
      typeof embeddingContextFromStored
    >[0];

    return {
      id: catalog.id,
      label: catalog.label,
      gameCount: catalog.gameCount,
      context: embeddingContextFromStored(stored),
    };
  } catch (error) {
    if (isMissingCatalogTableError(error)) return null;
    throw error;
  }
}

export async function activateEmbeddingCatalog(catalogId: string): Promise<void> {
  await prisma.$transaction([
    prisma.embeddingCatalog.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    }),
    prisma.embeddingCatalog.update({
      where: { id: catalogId },
      data: { isActive: true },
    }),
  ]);
}
