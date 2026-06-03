import { buildPairTrainingRows, type TrainingRow } from "@/lib/ml/training-features";

export const WORKER_EVENTS = {
  progress: "progress",
  trainingLog: "trainingLog",
  complete: "complete",
  error: "error",
} as const;

export type WorkerCandidate = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  gameVector: number[];
  vectorScore: number;
};

export type TfPrediction = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  tfScore: number;
};

export type WorkerRecommendation = {
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  matchPercent: number;
};

export type WorkerMessage =
  | { type: typeof WORKER_EVENTS.progress; progress: number }
  | {
      type: typeof WORKER_EVENTS.trainingLog;
      epoch: number;
      loss: number;
      accuracy: number;
    }
  | {
      type: typeof WORKER_EVENTS.complete;
      predictions: TfPrediction[];
    }
  | { type: typeof WORKER_EVENTS.error; message: string };

export async function fetchTrainingPayload(): Promise<{
  pairs: Array<{ sourceGameId: string; targetGameId: string; weight: number }>;
  gameVectors: Record<string, number[]>;
}> {
  const res = await fetch("/api/games/training-data");
  const json = await res.json();
  if (!json.ok) {
    throw new Error(json.message ?? "Failed to load training data");
  }
  return {
    pairs: json.pairs,
    gameVectors: json.gameVectors,
  };
}

export function buildTrainingRowsFromPayload(
  pairs: Array<{ sourceGameId: string; targetGameId: string; weight: number }>,
  gameVectors: Record<string, number[]>,
): TrainingRow[] {
  return buildPairTrainingRows(pairs, gameVectors, 1);
}

export function createRecommendationWorker(): Worker {
  return new Worker("/workers/recommendation-worker.js", { type: "module" });
}

export function runRecommendationInWorker(options: {
  profileVector: number[];
  playedGameWeightedVector?: number[] | null;
  playedGameVectors?: number[][];
  candidates: WorkerCandidate[];
  trainingRows: TrainingRow[];
  retrain?: boolean;
  onMessage: (msg: WorkerMessage) => void;
}): Worker {
  const worker = createRecommendationWorker();

  worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
    options.onMessage(e.data);
  };

  worker.onerror = () => {
    options.onMessage({ type: WORKER_EVENTS.error, message: "Worker crashed" });
  };

  worker.postMessage({
    action: "trainAndRecommend",
    profileVector: options.profileVector,
    playedGameWeightedVector: options.playedGameWeightedVector ?? null,
    playedGameVectors: options.playedGameVectors ?? [],
    candidates: options.candidates,
    trainingRows: options.trainingRows,
    retrain: options.retrain ?? false,
  });

  return worker;
}
