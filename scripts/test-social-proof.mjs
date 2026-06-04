/** Social proof floor tests (mirrors social-proof.ts) */

const SOCIAL_PROOF_MIN_POSITIVE = 5_000;
const SOCIAL_PROOF_MIN_RECOMMENDATIONS = 5_000;

function getSocialMetrics(game) {
  return {
    positive: game.positiveReviews ?? Number(game.raw?.positive ?? 0),
    recommendations: game.recommendations ?? Number(game.raw?.recommendations ?? 0),
    ownersMid: game.estimatedOwnersMid ?? Number(game.raw?.ownersMid ?? 0),
  };
}

function passesSocialProofFloor(game) {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (ownersMid >= 2_000_000) return true;
  if (positive >= 50_000 || recommendations >= 40_000) return true;

  if (
    positive >= SOCIAL_PROOF_MIN_POSITIVE &&
    recommendations >= SOCIAL_PROOF_MIN_RECOMMENDATIONS
  ) {
    return true;
  }

  if (positive >= 8_000 && recommendations >= 3_000) return true;
  if (combined >= 12_000) return true;

  return false;
}

function passesSocialProofFloorRelaxed(game) {
  if (passesSocialProofFloor(game)) return true;
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (combined < 2_000) return false;
  if (positive >= 3_000 && recommendations >= 2_000) return true;
  if (positive >= 4_000 || recommendations >= 4_000) return true;
  return ownersMid >= 500_000;
}

function passesSocialProofFloorEmergency(game) {
  if (passesSocialProofFloorRelaxed(game)) return true;
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;
  if (combined < 800) return false;
  if (positive >= 1_000 && recommendations >= 800) return true;
  if (combined >= 2_500) return true;
  return ownersMid >= 100_000;
}

function passesSocialProofByMode(game, mode) {
  if (mode === "strict") return passesSocialProofFloor(game);
  if (mode === "relaxed") return passesSocialProofFloorRelaxed(game);
  return passesSocialProofFloorEmergency(game);
}

const microGame = {
  positiveReviews: 6,
  recommendations: 0,
  raw: { positive: 6, recommendations: 0 },
};

const evilQuest = {
  positiveReviews: 580,
  recommendations: 511,
  estimatedOwnersMid: 75_000,
  raw: { positive: 580, recommendations: 511 },
};

const solidGame = {
  positiveReviews: 12_000,
  recommendations: 9_000,
  raw: { positive: 12000, recommendations: 9000 },
};

const borderlineAa = {
  positiveReviews: 5_200,
  recommendations: 5_100,
  raw: { positive: 5200, recommendations: 5100 },
};

if (passesSocialProofFloor(microGame)) {
  throw new Error("6 reviews should not pass social proof floor");
}

if (passesSocialProofFloor(evilQuest)) {
  throw new Error("EvilQuest (~580 reviews) should not pass strict social proof floor");
}

if (!passesSocialProofFloor(solidGame)) {
  throw new Error("12k reviews should pass social proof floor");
}

if (!passesSocialProofFloor(borderlineAa)) {
  throw new Error("5k+5k should pass social proof floor");
}

if (passesSocialProofFloorRelaxed(evilQuest)) {
  throw new Error("EvilQuest should not pass relaxed floor either");
}

const emergencyGame = {
  positiveReviews: 1_200,
  recommendations: 900,
  raw: { positive: 1200, recommendations: 900 },
};

if (!passesSocialProofFloorEmergency(emergencyGame)) {
  throw new Error("1.2k+900 should pass emergency floor");
}

if (passesSocialProofFloorEmergency(evilQuest)) {
  throw new Error("EvilQuest should not pass emergency floor");
}

console.log("social proof tests OK");
