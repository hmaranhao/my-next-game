import type { CoOccurrencePair } from "@/types/game";
import { EMBEDDING_DIMENSION } from "@/types/embedding";

export type TrainingRow = {
  input: number[];
  label: number;
};

export type GameVectorMap = Record<string, number[]>;

/** Pair (source → target) positives + random negatives for TF.js binary training. */
export function buildPairTrainingRows(
  pairs: CoOccurrencePair[],
  gameVectors: GameVectorMap,
  negativeRatio = 1,
): TrainingRow[] {
  const rows: TrainingRow[] = [];
  const gameIds = Object.keys(gameVectors);

  for (const pair of pairs) {
    const source = gameVectors[pair.sourceGameId];
    const target = gameVectors[pair.targetGameId];
    if (!source || !target) continue;

    rows.push({
      input: [...source, ...target],
      label: 1,
    });

    for (let n = 0; n < negativeRatio; n++) {
      const randomId = gameIds[Math.floor(Math.random() * gameIds.length)];
      if (!randomId || randomId === pair.targetGameId) continue;
      const random = gameVectors[randomId];
      if (!random) continue;
      rows.push({
        input: [...source, ...random],
        label: 0,
      });
    }
  }

  return rows;
}

export function concatProfileGameVectors(
  profileVector: number[],
  gameVector: number[],
): number[] {
  if (
    profileVector.length !== EMBEDDING_DIMENSION ||
    gameVector.length !== EMBEDDING_DIMENSION
  ) {
    throw new Error("Profile and game vectors must be 128 dimensions");
  }
  return [...profileVector, ...gameVector];
}

export function pickBestCandidate(
  profileVector: number[],
  candidates: Array<{ gameId: string; gameVector: number[]; score: number }>,
): { gameId: string; matchPercent: number } | null {
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    gameId: best.gameId,
    matchPercent: Math.round(Math.min(100, Math.max(0, best.score * 100))),
  };
}
