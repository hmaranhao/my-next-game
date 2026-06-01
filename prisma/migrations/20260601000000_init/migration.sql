-- CreateExtension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "ProfileSource" AS ENUM ('STEAM', 'MANUAL');

-- CreateTable
CREATE TABLE "user_profile_snapshots" (
    "id" TEXT NOT NULL,
    "steamId" TEXT,
    "source" "ProfileSource" NOT NULL,
    "profile" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_profile_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lgpd_consents" (
    "id" TEXT NOT NULL,
    "profileSnapshotId" TEXT,
    "policyVersion" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "locale" TEXT,
    "userAgentHash" TEXT,

    CONSTRAINT "lgpd_consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_sessions" (
    "id" TEXT NOT NULL,
    "profileSnapshotId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_candidates" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "gameExternalId" TEXT NOT NULL,
    "gameMetadata" JSONB NOT NULL,
    "embedding" vector(128),
    "distance" DOUBLE PRECISION,
    "rank" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_profile_snapshots_steamId_idx" ON "user_profile_snapshots"("steamId");

-- CreateIndex
CREATE INDEX "lgpd_consents_profileSnapshotId_idx" ON "lgpd_consents"("profileSnapshotId");

-- CreateIndex
CREATE INDEX "recommendation_sessions_profileSnapshotId_idx" ON "recommendation_sessions"("profileSnapshotId");

-- CreateIndex
CREATE INDEX "recommendation_candidates_sessionId_idx" ON "recommendation_candidates"("sessionId");

-- CreateIndex
CREATE INDEX "recommendation_candidates_gameExternalId_idx" ON "recommendation_candidates"("gameExternalId");

-- AddForeignKey
ALTER TABLE "lgpd_consents" ADD CONSTRAINT "lgpd_consents_profileSnapshotId_fkey" FOREIGN KEY ("profileSnapshotId") REFERENCES "user_profile_snapshots"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_sessions" ADD CONSTRAINT "recommendation_sessions_profileSnapshotId_fkey" FOREIGN KEY ("profileSnapshotId") REFERENCES "user_profile_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_candidates" ADD CONSTRAINT "recommendation_candidates_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "recommendation_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
