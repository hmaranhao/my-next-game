/** Last-played anchor tests (10h+ playtime gate) */

const MIN = 600;

function hasMeaningful(entry) {
  return entry.playtimeMinutes >= MIN;
}

function resolveMeaningfulLastPlayedAnchor(recentGames, libraryGames) {
  for (const entry of recentGames) {
    if (hasMeaningful(entry)) return entry;
  }

  const withRecency = libraryGames
    .filter(hasMeaningful)
    .filter((e) => e.lastPlayedAt);

  if (withRecency.length) {
    return withRecency.sort(
      (a, b) =>
        new Date(b.lastPlayedAt).getTime() - new Date(a.lastPlayedAt).getTime(),
    )[0];
  }

  const byPlaytime = libraryGames.filter(hasMeaningful);
  if (byPlaytime.length) {
    return byPlaytime.sort((a, b) => b.playtimeMinutes - a.playtimeMinutes)[0];
  }

  return null;
}

const recentQuickTry = [
  { appId: 1, name: "Quick Try", playtimeMinutes: 45, lastPlayedAt: "2026-06-01T00:00:00Z" },
  { appId: 2, name: "Real Game", playtimeMinutes: 1200, lastPlayedAt: "2026-05-30T00:00:00Z" },
];

const pick = resolveMeaningfulLastPlayedAnchor(recentQuickTry, []);
if (pick?.name !== "Real Game") {
  throw new Error(`expected Real Game, got ${pick?.name}`);
}

const onlyShort = [{ appId: 3, name: "Demo", playtimeMinutes: 30 }];
if (resolveMeaningfulLastPlayedAnchor(onlyShort, onlyShort) !== null) {
  throw new Error("short playtime should not anchor");
}

console.log("last-played anchor tests OK");
