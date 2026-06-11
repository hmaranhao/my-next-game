import type { CoOccurrencePair, NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import type { DistanceMetric, ScoredCandidate } from "@/types/embedding";
import { getVectorSearchBackend } from "./config";
import { getActiveCatalogEntryCount } from "./catalog";
import { findTopGameCandidatesPg } from "./pg-search";
import { findTopGameCandidates } from "./search";
import type { EmbeddingContext } from "./context";
import { mergeRejectedGameIds } from "./taste-signals";
import { loadFeedbackForProfile } from "@/lib/recommendations/feedback";

export type SearchBackend = "pg" | "memory";

export type CandidateSearchOutcome = {
  queryVector: Float32Array;
  candidates: ScoredCandidate[];
  contextMeta: EmbeddingContext;
  profileTags: string[];
  topK: number;
  scoredCount: number;
  searchBackend: SearchBackend;
};

export async function findTopGameCandidatesAsync(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  metric: DistanceMetric,
  profileSnapshotId: string,
  extraRejectIds: string[] = [],
  options?: {
    ignoreFeedback?: boolean;
    coOccurrencePairs?: CoOccurrencePair[];
  },
): Promise<CandidateSearchOutcome & { rejectedGameIds: string[] }> {
  const coOccurrencePairs = options?.coOccurrencePairs ?? [];
  const feedback = options?.ignoreFeedback
    ? []
    : await loadFeedbackForProfile(profileSnapshotId, profile);
  const rejectedGameIds = [
    ...mergeRejectedGameIds(feedback, extraRejectIds),
  ];

  let backend = getVectorSearchBackend();

  if (backend === "auto") {
    const indexed = await getActiveCatalogEntryCount();
    backend = indexed > 0 ? "pg" : "memory";
  }

  if (backend === "pg") {
    const pgResult = await findTopGameCandidatesPg(
      profile,
      games,
      metric,
      feedback,
      extraRejectIds,
      coOccurrencePairs,
    );
    if (pgResult) return { ...pgResult, rejectedGameIds };
  }

  const memory = findTopGameCandidates(
    profile,
    games,
    metric,
    feedback,
    extraRejectIds,
    coOccurrencePairs,
  );
  return { ...memory, searchBackend: "memory", rejectedGameIds };
}
