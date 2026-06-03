/** Unit tests for playtime-weighted library encoding */

function recencyMultiplier(lastPlayedAt) {
  if (!lastPlayedAt) return 1;
  const days = (Date.now() - new Date(lastPlayedAt).getTime()) / 86_400_000;
  if (days <= 30) return 1.25;
  if (days <= 90) return 1.1;
  if (days <= 365) return 1;
  return 0.85;
}

function entryPlaytimeWeight(entry) {
  const minutes = Math.max(0, entry.playtimeMinutes);
  let weight = Math.log10(minutes + 10);
  if (minutes > 0 && minutes < 120) weight *= 0.35;
  weight *= recencyMultiplier(entry.lastPlayedAt);
  if (minutes === 0) weight = 1;
  return Math.max(0.1, weight);
}

function weightedAverageVectors(vectors, weights) {
  const dim = vectors[0].length;
  const out = new Array(dim).fill(0);
  let total = 0;
  for (let v = 0; v < vectors.length; v++) {
    total += weights[v];
    for (let i = 0; i < dim; i++) out[i] += vectors[v][i] * weights[v];
  }
  return out.map((x) => x / total);
}

const heavy = { playtimeMinutes: 6000, lastPlayedAt: new Date().toISOString() };
const light = { playtimeMinutes: 30, lastPlayedAt: "2020-01-01T00:00:00.000Z" };

const wHeavy = entryPlaytimeWeight(heavy);
const wLight = entryPlaytimeWeight(light);

if (wHeavy <= wLight) {
  throw new Error("heavy playtime should outweigh abandoned game");
}

const avg = weightedAverageVectors(
  [
    [1, 0],
    [0, 1],
  ],
  [wHeavy, wLight],
);

if (avg[0] <= avg[1]) {
  throw new Error("weighted average should lean toward heavy vector");
}

console.log("playtime weight tests OK");
