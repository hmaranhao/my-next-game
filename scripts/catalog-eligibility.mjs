/** Shared catalog eligibility (mirrors src/lib/catalog/eligibility.ts). */

const CATALOG_MIN_OWNERS = 1_000_000;
const CATALOG_MIN_POSITIVE = 200_000;
const CATALOG_MIN_RECOMMENDATIONS = 200_000;
const CATALOG_PUBLISHER_MIN_POSITIVE = 100_000;
const CATALOG_PUBLISHER_MIN_RECOMMENDATIONS = 100_000;

const MAJOR_PUBLISHER_HINTS = new Set([
  "electronic arts",
  "ea",
  "ubisoft",
  "activision",
  "bethesda",
  "rockstar",
  "square enix",
  "capcom",
  "bandai namco",
  "sony interactive",
  "microsoft",
  "xbox game studios",
  "blizzard",
  "2k",
  "warner bros",
  "take-two",
  "cd projekt",
  "fromsoftware",
  "valve",
  "epic games",
  "nintendo",
  "sega",
  "koei tecmo",
  "paradox interactive",
  "hello games",
  "crytek",
  "bohemia interactive",
  "guerrilla",
  "naughty dog",
  "insomniac",
  "arkane",
  "id software",
  "respawn",
  "dice",
  "bioware",
  "creative assembly",
  "frontier developments",
  "rebellion",
  "techland",
  "warhorse",
  "remedy",
  "avalanche",
  "io interactive",
  "digital extremes",
  "grinding gear",
  "fatshark",
  "arrowhead",
  "embark studios",
  "amazon games",
]);

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

function normPublisherName(name) {
  if (!name?.trim()) return "";
  return name
    .toLowerCase()
    .replace(
      /\b(inc|llc|ltd|corp|co\.|studios?|games?|entertainment|interactive)\b/g,
      "",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function hasMajorPublisherHint(game) {
  const pub = normPublisherName(game.publisher);
  if (!pub) return false;
  for (const hint of MAJOR_PUBLISHER_HINTS) {
    if (pub.includes(hint) || hint.includes(pub)) return true;
  }
  return false;
}

export function isCasualGame(game) {
  return hasMetadataToken(game, "casual");
}

export function isCatalogEligible(game) {
  if (isCasualGame(game)) return false;

  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  if (ownersMid < CATALOG_MIN_OWNERS) return false;

  const passesStandardFloor =
    positive >= CATALOG_MIN_POSITIVE ||
    recommendations >= CATALOG_MIN_RECOMMENDATIONS;

  if (passesStandardFloor) return true;

  if (!hasMajorPublisherHint(game)) return false;

  return (
    positive >= CATALOG_PUBLISHER_MIN_POSITIVE ||
    recommendations >= CATALOG_PUBLISHER_MIN_RECOMMENDATIONS
  );
}
