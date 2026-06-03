import type { DistanceMetric } from "@/types/embedding";
import { getDimensionWeights } from "./config";

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/** Cosine with higher emphasis on tag dimensions (and other segment weights). */
export function weightedCosineSimilarity(
  a: Float32Array,
  b: Float32Array,
  weights: Float32Array,
): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const wi = weights[i];
    const ai = a[i] * wi;
    const bi = b[i] * wi;
    dot += ai * bi;
    na += ai * ai;
    nb += bi * bi;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function l2Distance(a: Float32Array, b: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

export function weightedL2Distance(
  a: Float32Array,
  b: Float32Array,
  weights: Float32Array,
): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = (a[i] - b[i]) * weights[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** Higher score = better match */
export function scoreVectors(
  query: Float32Array,
  candidate: Float32Array,
  metric: DistanceMetric,
): { score: number; distance: number } {
  const weights = getDimensionWeights();

  if (metric === "cosine") {
    const sim = weightedCosineSimilarity(query, candidate, weights);
    return { score: sim, distance: 1 - sim };
  }
  const dist = weightedL2Distance(query, candidate, weights);
  return { score: 1 / (1 + dist), distance: dist };
}

export function getDistanceMetric(): DistanceMetric {
  const raw = (process.env.VECTOR_DISTANCE ?? "cosine").toLowerCase();
  return raw === "l2" ? "l2" : "cosine";
}
