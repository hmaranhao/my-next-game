/** Production tier tests (mirrors game-tier.ts) */

const AAA_PUBLISHER_HINTS = new Set([
  "electronic arts", "ea", "ubisoft", "activision", "valve",
]);

function getSocialMetrics(game) {
  return {
    positive: game.positiveReviews ?? 0,
    recommendations: game.recommendations ?? 0,
    ownersMid: game.estimatedOwnersMid ?? 0,
  };
}

function normStudio(name) {
  if (!name?.trim()) return "";
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|co\.|studios?|games?|entertainment|interactive)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasAaaPublisherHint(game) {
  const pub = normStudio(game.publisher);
  if (!pub) return false;
  for (const hint of AAA_PUBLISHER_HINTS) {
    if (pub.includes(hint) || hint.includes(pub)) return true;
  }
  return false;
}

function classifyGameTier(game) {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (
    ownersMid >= 2_000_000 ||
    positive >= 40_000 ||
    recommendations >= 30_000 ||
    combined >= 60_000 ||
    (ownersMid >= 800_000 && hasAaaPublisherHint(game))
  ) {
    return "AAA";
  }

  if (
    ownersMid >= 150_000 ||
    positive >= 5_000 ||
    recommendations >= 5_000 ||
    combined >= 8_000
  ) {
    return "AA";
  }

  return "INDIE";
}

const cyberpunk = {
  positiveReviews: 500_000,
  recommendations: 400_000,
  estimatedOwnersMid: 15_000_000,
  publisher: "CD PROJEKT RED",
};

const evilQuest = {
  positiveReviews: 580,
  recommendations: 511,
  estimatedOwnersMid: 75_000,
  publisher: "ChaosSoft Games",
};

const hollowKnight = {
  positiveReviews: 120_000,
  recommendations: 95_000,
  estimatedOwnersMid: 3_000_000,
  publisher: "Team Cherry",
  developers: ["Team Cherry"],
};

if (classifyGameTier(cyberpunk) !== "AAA") {
  throw new Error("Cyberpunk-scale game should be AAA");
}

if (classifyGameTier(evilQuest) !== "INDIE") {
  throw new Error("EvilQuest should be INDIE");
}

if (classifyGameTier(hollowKnight) !== "AAA") {
  throw new Error("Hollow Knight should be AAA by review count");
}

const aaGame = {
  positiveReviews: 6_000,
  recommendations: 5_500,
  estimatedOwnersMid: 200_000,
  publisher: "Some Studio",
};

if (classifyGameTier(aaGame) !== "AA") {
  throw new Error("6k+5.5k game should be AA");
}

console.log("game tier tests OK");
