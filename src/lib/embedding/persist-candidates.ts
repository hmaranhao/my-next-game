import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { NormalizedGame } from "@/types/game";
import type { ScoredCandidate } from "@/types/embedding";
import { vectorToArray } from "./encode";
import { toPgVectorLiteral } from "./vector-utils";

export async function persistCandidateSession(
  profileSnapshotId: string,
  candidates: ScoredCandidate[],
): Promise<string> {
  const session = await prisma.recommendationSession.create({
    data: { profileSnapshotId },
  });

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const vec = toPgVectorLiteral(vectorToArray(c.vector));
    const metadata = c.game as NormalizedGame;

    await prisma.$executeRawUnsafe(
      `INSERT INTO recommendation_candidates
        (id, "sessionId", "gameExternalId", "gameMetadata", embedding, distance, rank, "createdAt")
       VALUES ($1, $2, $3, $4::jsonb, $5::vector, $6, $7, NOW())`,
      randomUUID(),
      session.id,
      c.gameId,
      JSON.stringify(metadata),
      vec,
      c.distance,
      i + 1,
    );
  }

  return session.id;
}

export async function loadProfileSnapshot(snapshotId: string) {
  const row = await prisma.userProfileSnapshot.findUnique({
    where: { id: snapshotId },
  });
  if (!row) return null;
  return {
    id: row.id,
    profile: row.profile as import("@/types/profile").NormalizedUserProfile,
  };
}
