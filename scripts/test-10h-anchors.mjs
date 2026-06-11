/** 10h+ anchor resolution tests (mirrors played-games.ts) */

const MEANINGFUL_ANCHOR_PLAYTIME_MINUTES = 600;

function hasMeaningfulAnchorPlaytime(entry) {
  return entry.playtimeMinutes >= MEANINGFUL_ANCHOR_PLAYTIME_MINUTES;
}

function resolveMeaningful10hAnchors(profile, limit = 5) {
  const library =
    profile.libraryGames?.length
      ? profile.libraryGames
      : [...profile.topGames, ...profile.recentGames];

  const ordered = [];

  for (const entry of profile.recentGames ?? []) {
    if (hasMeaningfulAnchorPlaytime(entry)) ordered.push(entry);
  }

  const library10h = library
    .filter(hasMeaningfulAnchorPlaytime)
    .filter((e) => e.lastPlayedAt)
    .sort(
      (a, b) =>
        new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
    );

  for (const entry of library10h) ordered.push(entry);

  const deduped = [];
  const seen = new Set();
  for (const entry of ordered) {
    if (entry.appId > 0 && seen.has(entry.appId)) continue;
    if (entry.appId > 0) seen.add(entry.appId);
    deduped.push(entry);
    if (deduped.length >= limit) break;
  }

  return deduped;
}

const profile = {
  recentGames: [
    { appId: 1, name: "Short Session", playtimeMinutes: 30, playtimeHours: 0.5 },
    { appId: 2, name: "Elden Ring", playtimeMinutes: 7200, playtimeHours: 120 },
    { appId: 3, name: "Cyberpunk", playtimeMinutes: 3600, playtimeHours: 60 },
  ],
  libraryGames: [],
  topGames: [],
};

const anchors = resolveMeaningful10hAnchors(profile, 5);

if (anchors.length !== 2) {
  throw new Error(`expected 2 anchors, got ${anchors.length}`);
}

if (anchors[0].name !== "Elden Ring") {
  throw new Error("first anchor should be first 10h+ in recent list");
}

for (const a of anchors) {
  if (a.playtimeMinutes < 600) {
    throw new Error(`anchor ${a.name} below 10h`);
  }
}

console.log("10h anchor tests OK");
