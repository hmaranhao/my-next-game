-- Game catalog indexed for pgvector KNN search
CREATE TABLE "embedding_catalogs" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "contextMeta" JSONB NOT NULL,
    "gameCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedding_catalogs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "game_catalog_entries" (
    "id" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "gameExternalId" TEXT NOT NULL,
    "gameMetadata" JSONB NOT NULL,
    "searchEmbedding" vector(128) NOT NULL,
    "popularityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "game_catalog_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "game_catalog_entries_catalogId_gameExternalId_key"
    ON "game_catalog_entries"("catalogId", "gameExternalId");

CREATE INDEX "game_catalog_entries_catalogId_idx"
    ON "game_catalog_entries"("catalogId");

CREATE INDEX "embedding_catalogs_isActive_idx"
    ON "embedding_catalogs"("isActive");

-- HNSW index for approximate nearest neighbor (cosine distance)
CREATE INDEX "game_catalog_entries_search_embedding_hnsw_idx"
    ON "game_catalog_entries"
    USING hnsw ("searchEmbedding" vector_cosine_ops);

ALTER TABLE "game_catalog_entries"
    ADD CONSTRAINT "game_catalog_entries_catalogId_fkey"
    FOREIGN KEY ("catalogId") REFERENCES "embedding_catalogs"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
