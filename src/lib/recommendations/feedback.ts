import { prisma } from "@/lib/prisma";
import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type {
  FeedbackRating,
  StoredFeedback,
} from "@/lib/embedding/taste-signals";
import { profileFeedbackKey } from "./profile-key";

export async function loadFeedbackForProfile(
  profileSnapshotId: string,
  profile: NormalizedUserProfile,
): Promise<StoredFeedback[]> {
  try {
    const key = profileFeedbackKey(profile);
    const rows = await prisma.recommendationFeedback.findMany({
      where: {
        OR: [{ profileSnapshotId }, { steamId: key }],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return rows.map((r) => ({
      gameExternalId: r.gameExternalId,
      rating: r.rating as FeedbackRating,
      gameMetadata: r.gameMetadata as NormalizedGame | null,
    }));
  } catch {
    return [];
  }
}

export async function saveRecommendationFeedback(input: {
  sessionId: string;
  profileSnapshotId: string;
  profile: NormalizedUserProfile;
  gameExternalId: string;
  rating: FeedbackRating;
  gameMetadata: NormalizedGame;
}): Promise<void> {
  await prisma.recommendationFeedback.create({
    data: {
      sessionId: input.sessionId,
      profileSnapshotId: input.profileSnapshotId,
      steamId: profileFeedbackKey(input.profile),
      gameExternalId: input.gameExternalId,
      rating: input.rating,
      gameMetadata: input.gameMetadata,
    },
  });
}
