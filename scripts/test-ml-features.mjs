/** Unit tests for ML feature helpers (mirrors src/lib/ml/training-features.ts) */

function buildPairTrainingRows(pairs, gameVectors, negativeRatio = 1) {
  const rows = [];
  const gameIds = Object.keys(gameVectors);

  for (const pair of pairs) {
    const source = gameVectors[pair.sourceGameId];
    const target = gameVectors[pair.targetGameId];
    if (!source || !target) continue;

    rows.push({ input: [...source, ...target], label: 1 });

    for (let n = 0; n < negativeRatio; n++) {
      const randomId = gameIds[Math.floor(Math.random() * gameIds.length)];
      if (!randomId || randomId === pair.targetGameId) continue;
      const random = gameVectors[randomId];
      if (!random) continue;
      rows.push({ input: [...source, ...random], label: 0 });
    }
  }

  return rows;
}

function pickBestCandidate(profileVector, candidates) {
  if (!candidates.length) return null;
  const best = candidates.reduce((a, b) => (b.score > a.score ? b : a));
  return {
    gameId: best.gameId,
    matchPercent: Math.round(Math.min(100, Math.max(0, best.score * 100))),
  };
}

const vec = (seed) => Array.from({ length: 128 }, (_, i) => (seed + i) * 0.001);

const gameVectors = { a: vec(1), b: vec(2), c: vec(3) };
const pairs = [
  { sourceGameId: "a", targetGameId: "b", weight: 1 },
  { sourceGameId: "a", targetGameId: "c", weight: 0.5 },
];

const rows = buildPairTrainingRows(pairs, gameVectors, 0);
if (rows.length !== 2) throw new Error("expected 2 positive rows");
if (rows[0].label !== 1) throw new Error("expected positive label");
if (rows[0].input.length !== 256) throw new Error("expected 256-dim input");

const best = pickBestCandidate(vec(10), [
  { gameId: "x", gameVector: vec(1), score: 0.4 },
  { gameId: "y", gameVector: vec(2), score: 0.91 },
]);
if (best?.gameId !== "y") throw new Error("wrong best candidate");
if (best?.matchPercent !== 91) throw new Error("wrong match percent");

console.log("ml feature tests OK");
