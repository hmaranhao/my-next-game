import type { ManualProfileInput, NormalizedUserProfile } from "@/types/profile";
import {
  fetchAchievementSample,
  fetchGenresForApp,
  fetchOwnedGames,
  fetchPlayerSummary,
  fetchRecentGames,
  mapGameEntry,
  resolveSteamId,
  SteamApiError,
} from "./client";

const PUBLIC_VISIBILITY = 3;

export async function buildSteamProfile(
  steamInput: string,
): Promise<NormalizedUserProfile> {
  const steamId = await resolveSteamId(steamInput);
  const summary = await fetchPlayerSummary(steamId);

  const isPublic = summary.communityvisibilitystate === PUBLIC_VISIBILITY;

  if (!isPublic) {
    throw new SteamApiError(
      "PROFILE_PRIVATE",
      "Steam profile is private. Use the manual form instead.",
    );
  }

  const [owned, recent] = await Promise.all([
    fetchOwnedGames(steamId),
    fetchRecentGames(steamId),
  ]);

  const sorted = [...owned].sort(
    (a, b) => (b.playtime_forever ?? 0) - (a.playtime_forever ?? 0),
  );
  const topGames = sorted.slice(0, 10).map(mapGameEntry);
  const libraryGames = sorted
    .filter((g) => (g.playtime_forever ?? 0) > 0)
    .slice(0, 50)
    .map(mapGameEntry);
  const recentGames = recent.map(mapGameEntry);
  const playedAppIds = owned.map((g) => g.appid);

  const genreSet = new Set<string>();
  for (const game of sorted.slice(0, 5)) {
    const genres = await fetchGenresForApp(game.appid);
    genres.forEach((g) => genreSet.add(g));
  }

  let achievementSample: NormalizedUserProfile["achievementSample"] = null;
  const topForAchievements = sorted[0];
  if (topForAchievements) {
    const stats = await fetchAchievementSample(steamId, topForAchievements.appid);
    if (stats) {
      achievementSample = {
        appId: topForAchievements.appid,
        gameName: topForAchievements.name ?? `App ${topForAchievements.appid}`,
        unlocked: stats.unlocked,
        total: stats.total,
      };
    }
  }

  const accountCreatedAt = summary.timecreated
    ? new Date(summary.timecreated * 1000).toISOString()
    : null;
  const accountAgeYears = summary.timecreated
    ? Math.floor(
        (Date.now() - summary.timecreated * 1000) / (365.25 * 24 * 3600 * 1000),
      )
    : null;

  const totalPlaytimeMinutes = owned.reduce(
    (sum, g) => sum + (g.playtime_forever ?? 0),
    0,
  );

  return {
    source: "STEAM",
    steamId,
    displayName: summary.personaname,
    profileUrl: summary.profileurl,
    avatarUrl: summary.avatarfull,
    countryCode: summary.loccountrycode ?? null,
    accountCreatedAt,
    accountAgeYears,
    isPublic: true,
    inferredGenres: [...genreSet],
    topGames,
    libraryGames,
    recentGames,
    playedAppIds,
    playedGameNames: [],
    totalPlaytimeMinutes,
    achievementSample,
  };
}

export function buildManualProfile(
  input: ManualProfileInput,
): NormalizedUserProfile {
  const favoriteGenres = input.favoriteGenres.map((g) => g.trim()).filter(Boolean);
  const favoriteGames = input.favoriteGames.map((g) => g.trim()).filter(Boolean);
  const playedGameNames = input.playedGames.map((g) => g.trim()).filter(Boolean);
  const totalMinutes = (input.approximatePlaytimeHours ?? 0) * 60;

  const libraryGames = favoriteGames.map((name, i) => {
    const share = favoriteGames.length > 0 ? 1 / Math.pow(2, i) : 1;
    const weightSum = favoriteGames.reduce((s, _, idx) => s + 1 / Math.pow(2, idx), 0);
    const playtimeMinutes =
      totalMinutes > 0
        ? Math.round((totalMinutes * share) / weightSum)
        : Math.max(60, (favoriteGames.length - i) * 60);

    return {
      appId: -(i + 1),
      name,
      playtimeMinutes,
      playtimeHours: Math.round((playtimeMinutes / 60) * 10) / 10,
      lastPlayedAt: null,
      iconUrl: null,
    };
  });

  return {
    source: "MANUAL",
    steamId: null,
    displayName: input.displayName.trim() || "Jogador",
    profileUrl: null,
    avatarUrl: null,
    countryCode: input.countryCode?.trim() || null,
    accountCreatedAt: null,
    accountAgeYears: input.ageRange ? parseAgeRangeMidpoint(input.ageRange) : null,
    isPublic: false,
    inferredGenres: favoriteGenres,
    topGames: libraryGames.slice(0, 10),
    libraryGames,
    recentGames: [],
    playedAppIds: [],
    playedGameNames,
    totalPlaytimeMinutes: totalMinutes,
    achievementSample: null,
    rawMeta: { ageRange: input.ageRange ?? null },
  };
}

function parseAgeRangeMidpoint(ageRange: string): number | null {
  const match = ageRange.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export { SteamApiError };
