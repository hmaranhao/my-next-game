/** Unit tests for hybrid ranking (mirrors src/lib/ml/rank-candidates.ts) */

function minMaxNormalize(values) {
  if (!values.length) return [];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  if (span < 1e-9) return values.map(() => 0.5);
  return values.map((v) => (v - min) / span);
}

const RANK_W = 0.9;
const TF_W = 0.1;
const MATCH_FLOOR = 62;
const MATCH_CEIL = 97;
const TOP3_MIN = [88, 84, 80];

function calibrateToMatchPercents(values) {
  const n = values.length;
  if (n === 0) return [];
  const order = values.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v);
  const out = new Array(n);
  order.forEach(({ i }, rank) => {
    const relative = n <= 1 ? 1 : 1 - rank / (n - 1);
    let pct = Math.round(MATCH_FLOOR + relative * (MATCH_CEIL - MATCH_FLOOR));
    if (rank < TOP3_MIN.length) pct = Math.max(pct, TOP3_MIN[rank]);
    out[i] = Math.min(MATCH_CEIL, pct);
  });
  return out;
}

function scoreAllHybrid(candidates, tfById) {
  const tfRaw = candidates.map((c) => tfById.get(c.gameId) ?? 0);
  const tfNorm = minMaxNormalize(tfRaw);
  const scored = candidates.map((c, i) => {
    const rank = c.rankScore ?? c.vectorScore;
    const combined = RANK_W * rank + TF_W * tfNorm[i];
    return { ...c, combinedScore: combined, matchPercent: 0 };
  });
  const percents = calibrateToMatchPercents(scored.map((s) => s.combinedScore));
  return scored.map((s, i) => ({ ...s, matchPercent: percents[i] }));
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

const topByScore = [...scored].sort((a, b) => b.combinedScore - a.combinedScore)[0];
if (pick.gameId !== topByScore.gameId) {
  throw new Error(`pick must be top combined score: expected ${topByScore.gameId}, got ${pick.gameId}`);
}

if (pick.gameId !== "rpg-a") {
  throw new Error(`expected rpg-a, got ${pick.gameId}`);
}

if (pick.matchPercent < 80) {
  throw new Error(`expected calibrated match >= 80, got ${pick.matchPercent}`);
}

const topThree = [...scored]
  .sort((a, b) => b.combinedScore - a.combinedScore)
  .slice(0, 3);
for (const [i, entry] of topThree.entries()) {
  if (entry.matchPercent < TOP3_MIN[i]) {
    throw new Error(`top ${i + 1} should be >= ${TOP3_MIN[i]}, got ${entry.matchPercent}`);
  }
}

console.log("ml feature tests OK");
