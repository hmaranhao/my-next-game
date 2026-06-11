import type { CoOccurrencePair } from "@/types/game";

/** targetGameId → sourceGameId → pair weight */
export type CoOccurrenceIndex = Map<string, Map<string, number>>;

export function buildCoOccurrenceIndex(
  pairs: CoOccurrencePair[],
): CoOccurrenceIndex {
  const index: CoOccurrenceIndex = new Map();

  for (const pair of pairs) {
    let sources = index.get(pair.targetGameId);
    if (!sources) {
      sources = new Map();
      index.set(pair.targetGameId, sources);
    }
    sources.set(
      pair.sourceGameId,
      (sources.get(pair.sourceGameId) ?? 0) + pair.weight,
    );
  }

  return index;
}

/**
 * How strongly a candidate is linked to the user's library via co-play pairs.
 * Returns 0–1.
 */
export function computeCoOccurrenceAffinity(
  candidateId: string,
  libraryWeights: Map<string, number>,
  index: CoOccurrenceIndex,
): number {
  if (libraryWeights.size === 0) return 0;

  const sources = index.get(candidateId);
  if (!sources) return 0;

  let weightedSum = 0;
  for (const [libraryId, playWeight] of libraryWeights) {
    const pairWeight = sources.get(libraryId);
    if (pairWeight) weightedSum += pairWeight * playWeight;
  }

  if (weightedSum <= 0) return 0;
  return Math.min(1, Math.log10(weightedSum + 1) / 3.2);
}
