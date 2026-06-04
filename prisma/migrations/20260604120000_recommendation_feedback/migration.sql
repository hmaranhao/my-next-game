-- CreateEnum
CREATE TYPE "FeedbackRating" AS ENUM ('UP', 'DOWN');

-- CreateTable
CREATE TABLE "recommendation_feedback" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "profileSnapshotId" TEXT NOT NULL,
    "steamId" TEXT,
    "gameExternalId" TEXT NOT NULL,
    "rating" "FeedbackRating" NOT NULL,
    "gameMetadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recommendation_feedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "recommendation_feedback_profileSnapshotId_idx"
    ON "recommendation_feedback"("profileSnapshotId");

CREATE INDEX "recommendation_feedback_steamId_idx"
    ON "recommendation_feedback"("steamId");

CREATE INDEX "recommendation_feedback_sessionId_idx"
    ON "recommendation_feedback"("sessionId");

ALTER TABLE "recommendation_feedback"
    ADD CONSTRAINT "recommendation_feedback_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "recommendation_sessions"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
