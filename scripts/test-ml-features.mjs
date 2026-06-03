/** Unit tests for hybrid ranking (mirrors src/lib/ml/rank-candidates.ts) */

function minMaxNormalize(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

const RANK_W = 0.72;
const TF_W = 0.28;

function scoreAllHybrid(candidates, tfById) {
  const tfRaw = candidates.map((c) => tfById.get(c.gameId) ?? 0);
  const tfNorm = minMaxNormalize(tfRaw);
  return candidates.map((c, i) => {
    const rank = c.rankScore ?? c.vectorScore;
    const combined = RANK_W * rank + TF_W * tfNorm[i];
    return {
      ...c,
      matchPercent: Math.round(combined * 100),
      combinedScore: combined,
    };
  });
}

function pickHybrid(candidates, tfById) {
  const scored = scoreAllHybrid(candidates, tfById);
  return scored.reduce((a, b) => (b.combinedScore > a.combinedScore ? b : a));
}

const candidates = [
  { gameId: "rpg-a", name: "RPG A", vectorScore: 0.85, rankScore: 0.92 },
  { gameId: "fps-b", name: "FPS B", vectorScore: 0.35, rankScore: 0.4 },
  { gameId: "rpg-c", name: "RPG C", vectorScore: 0.8, rankScore: 0.88 },
];

const tf = new Map([
  ["rpg-a", 0.02],
  ["fps-b", 0.99],
  ["rpg-c", 0.01],
]);

const scored = scoreAllHybrid(candidates, tf);
const pick = pickHybrid(candidates, tf);

const pickInScored = scored.find((s) => s.gameId === pick.gameId);
if (pick.matchPercent !== pickInScored.matchPercent) {
  throw new Error("pick percent must match scored entry");
}

if (pick.gameId !== "rpg-a") {
  throw new Error(`expected rpg-a, got ${pick.gameId}`);
}

console.log("ml feature tests OK");
