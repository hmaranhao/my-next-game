/** Genre-first matching: Hunt + NMS anchors should beat Human Fall Flat. */

function norm(s) {
  return s.trim().toLowerCase();
}

function splitGenre(genre) {
  if (!genre) return [];
  return genre.split(/[,;/|]/).map((g) => norm(g)).filter(Boolean);
}

const STEAM_CATEGORIES = new Set(
  [
    "co-op",
    "multiplayer",
    "online co-op",
    "local co-op",
    "local multiplayer",
    "singleplayer",
    "split screen",
    "pvp",
  ].map(norm),
);

function isCategory(token) {
  return STEAM_CATEGORIES.has(norm(token));
}

function gameGenres(game) {
  return splitGenre(game.genre);
}

function gameplayTags(game) {
  const genres = new Set(gameGenres(game));
  return game.tags
    .map(norm)
    .filter((t) => t && !isCategory(t) && !genres.has(t));
}

function genreOverlap(anchors, candidate) {
  const anchorSet = new Set();
  for (const a of anchors) {
    for (const g of gameGenres(a)) anchorSet.add(g);
  }
  const candidateGenres = gameGenres(candidate);
  let shared = 0;
  for (const g of candidateGenres) {
    if (anchorSet.has(g)) shared += 1;
  }
  if (!shared) return 0;
  const union = anchorSet.size + candidateGenres.length - shared;
  return Math.min(1, shared / union + shared * 0.12);
}

function tagOverlap(anchor, candidate) {
  const aTags = new Set(gameplayTags(anchor));
  const cTags = gameplayTags(candidate);
  let shared = 0;
  for (const t of cTags) {
    if (aTags.has(t)) shared += 1;
  }
  if (!shared) return 0;
  return Math.min(1, shared / Math.max(2, Math.min(aTags.size, 8) * 0.5));
}

function affinity(anchors, candidate) {
  const genre = genreOverlap(anchors, candidate);
  let best = 0;
  for (const anchor of anchors) {
    const tag = tagOverlap(anchor, candidate);
    const score = genre === 0 ? tag * 0.1 : genre * 0.7 + tag * 0.1;
    best = Math.max(best, score);
  }
  if (genre === 0) return best * 0.35;
  return Math.max(best, genre * 0.85 + best * 0.15);
}

const hunt = {
  name: "Hunt: Showdown 1896",
  genre: "Action",
  tags: [
    "Open World",
    "Extraction Shooter",
    "Multiplayer",
    "FPS",
    "Co-op",
    "Horror",
  ],
};

const nms = {
  name: "No Man's Sky",
  genre: "Action, Adventure",
  tags: ["Open World", "Space", "Survival", "Multiplayer", "Exploration"],
};

const hff = {
  name: "Human Fall Flat",
  genre: "Adventure, Casual, Indie, Simulation",
  tags: [
    "Co-op",
    "Multiplayer",
    "Adventure",
    "Open World",
    "Sandbox",
    "Action",
    "Physics",
  ],
};

const actionCandidate = {
  name: "Example Action Game",
  genre: "Action",
  tags: ["FPS", "Multiplayer", "Horror"],
};

const anchors = [hunt, nms];
const hffScore = affinity(anchors, hff);
const actionScore = affinity(anchors, actionCandidate);

if (actionScore <= hffScore) {
  throw new Error(
    `Action candidate (${actionScore.toFixed(3)}) should beat Human Fall Flat (${hffScore.toFixed(3)})`,
  );
}

if (genreOverlap(anchors, hff) >= genreOverlap(anchors, actionCandidate)) {
  throw new Error("Action game should have stronger genre overlap than HFF");
}

console.log("genre matching tests OK", {
  hff: hffScore.toFixed(3),
  action: actionScore.toFixed(3),
});
