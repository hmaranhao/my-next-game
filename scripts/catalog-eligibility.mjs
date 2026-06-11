/** Shared catalog eligibility (mirrors src/lib/catalog/eligibility.ts). */

const CATALOG_MIN_OWNERS = 1_000_000;
const CATALOG_MIN_POSITIVE = 500_000;
const CATALOG_MIN_RECOMMENDATIONS = 500_000;
const CATALOG_INDIE_MIN_POSITIVE = 1_000_000;
const CATALOG_INDIE_MIN_RECOMMENDATIONS = 1_000_000;

export function getSocialMetrics(game) {
  return {
    positive: game.positiveReviews ?? Number(game.raw?.positive ?? 0),
    recommendations:
      game.recommendations ?? Number(game.raw?.recommendations ?? 0),
    ownersMid: game.estimatedOwnersMid ?? Number(game.raw?.ownersMid ?? 0),
  };
}

function splitGenreTokens(genre) {
  if (!genre?.trim()) return [];
  return genre
    .split(/[,;/|]/)
    .map((g) => g.trim())
    .filter(Boolean);
}

function normToken(value) {
  return value.trim().toLowerCase();
}

function hasMetadataToken(game, token) {
  const target = normToken(token);
  for (const g of splitGenreTokens(game.genre)) {
    if (normToken(g) === target) return true;
  }
  for (const tag of game.tags ?? []) {
    if (normToken(tag) === target) return true;
  }
  return false;
}

export function isCasualGame(game) {
  return hasMetadataToken(game, "casual");
}

export function isIndieLabeledGame(game) {
  return hasMetadataToken(game, "indie");
}

export function isCatalogEligible(game) {
  if (isCasualGame(game)) return false;

  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  if (ownersMid < CATALOG_MIN_OWNERS) return false;

  const minPositive = isIndieLabeledGame(game)
    ? CATALOG_INDIE_MIN_POSITIVE
    : CATALOG_MIN_POSITIVE;
  const minRecs = isIndieLabeledGame(game)
    ? CATALOG_INDIE_MIN_RECOMMENDATIONS
    : CATALOG_MIN_RECOMMENDATIONS;

  return positive >= minPositive || recommendations >= minRecs;
}
