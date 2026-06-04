import { EMBEDDING_DIMENSION } from "@/types/embedding";
import { getDimensionWeights } from "./config";

export function toPgVectorLiteral(values: number[] | Float32Array): string {
  const arr = values instanceof Float32Array ? Array.from(values) : values;
  return `[${arr.map((v) => Number(Number(v).toFixed(6))).join(",")}]`;
}

/** Pre-weight vectors so pgvector `<=>` matches weighted cosine / weighted L2. */
export function applySearchWeights(vec: Float32Array): Float32Array {
  const weights = getDimensionWeights();
  const out = new Float32Array(EMBEDDING_DIMENSION);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    out[i] = vec[i] * Math.sqrt(weights[i]);
  }
  return out;
}

export function arrayToFloat32(values: number[]): Float32Array {
  return new Float32Array(values);
}
