import type { ProfileApiError } from "@/types/profile";

export class SteamApiError extends Error {
  constructor(
    public readonly code: ProfileApiError["code"],
    message: string,
  ) {
    super(message);
    this.name = "SteamApiError";
  }
}

export function getSteamApiKey(): string {
  const key = process.env.STEAM_API_KEY?.trim();
  if (!key) {
    throw new SteamApiError(
      "MISSING_STEAM_API_KEY",
      "STEAM_API_KEY is not configured. Add it to .env",
    );
  }
  return key;
}

const STEAM_BASE = "https://api.steampowered.com";

type SteamFetchParams = Record<string, string | number | boolean>;

export async function steamApiGet<T>(
  path: string,
  params: SteamFetchParams,
): Promise<T> {
  const key = getSteamApiKey();
  const url = new URL(`${STEAM_BASE}${path}`);
  url.searchParams.set("key", key);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, String(v));
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new SteamApiError(
      "STEAM_API_ERROR",
      `Steam API HTTP ${res.status} for ${path}`,
    );
  }
  return res.json() as Promise<T>;
}

/** Parse vanity URL, profile URL, steam64 or plain vanity name */
export function parseSteamInput(input: string): {
  steamId?: string;
  vanity?: string;
} {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new SteamApiError("INVALID_INPUT", "Steam ID or profile URL is required");
  }

  if (/^\d{17}$/.test(trimmed)) {
    return { steamId: trimmed };
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const idMatch = url.pathname.match(/\/profiles\/(\d{17})/);
    if (idMatch) return { steamId: idMatch[1] };

    const vanityMatch = url.pathname.match(/\/id\/([^/]+)/);
    if (vanityMatch) return { vanity: decodeURIComponent(vanityMatch[1]) };
  } catch {
    /* not a URL — treat as vanity */
  }

  if (/^[a-zA-Z0-9_-]{2,32}$/.test(trimmed)) {
    return { vanity: trimmed };
  }

  throw new SteamApiError(
    "INVALID_INPUT",
    "Use Steam64 ID, profile URL, or vanity name",
  );
}

type ResolveVanityResponse = {
  response?: { success: number; steamid?: string; message?: string };
};

export async function resolveVanityToSteamId(vanity: string): Promise<string> {
  const data = await steamApiGet<ResolveVanityResponse>(
    "/ISteamUser/ResolveVanityURL/v0001/",
    { vanityurl: vanity },
  );
  if (data.response?.success === 1 && data.response.steamid) {
    return data.response.steamid;
  }
  throw new SteamApiError("STEAM_NOT_FOUND", "Steam profile not found");
}

export async function resolveSteamId(input: string): Promise<string> {
  const parsed = parseSteamInput(input);
  if (parsed.steamId) return parsed.steamId;
  if (parsed.vanity) return resolveVanityToSteamId(parsed.vanity);
  throw new SteamApiError("INVALID_INPUT", "Could not resolve Steam ID");
}

type PlayerSummary = {
  steamid: string;
  personaname: string;
  profileurl: string;
  avatarfull: string;
  loccountrycode?: string;
  timecreated?: number;
  communityvisibilitystate?: number;
};

type GetPlayerSummariesResponse = {
  response?: { players?: PlayerSummary[] };
};

export async function fetchPlayerSummary(
  steamId: string,
): Promise<PlayerSummary> {
  const data = await steamApiGet<GetPlayerSummariesResponse>(
    "/ISteamUser/GetPlayerSummaries/v0002/",
    { steamids: steamId },
  );
  const player = data.response?.players?.[0];
  if (!player) {
    throw new SteamApiError("STEAM_NOT_FOUND", "Steam player not found");
  }
  return player;
}

type OwnedGame = {
  appid: number;
  name?: string;
  playtime_forever?: number;
  rtime_last_played?: number;
  img_icon_url?: string;
};

type GetOwnedGamesResponse = {
  response?: {
    game_count?: number;
    games?: OwnedGame[];
  };
};

export async function fetchOwnedGames(steamId: string): Promise<OwnedGame[]> {
  const data = await steamApiGet<GetOwnedGamesResponse>(
    "/IPlayerService/GetOwnedGames/v0001/",
    {
      steamid: steamId,
      include_appinfo: true,
      include_played_free_games: true,
      format: "json",
    },
  );
  return data.response?.games ?? [];
}

type GetRecentGamesResponse = {
  response?: { games?: OwnedGame[] };
};

export async function fetchRecentGames(steamId: string): Promise<OwnedGame[]> {
  const data = await steamApiGet<GetRecentGamesResponse>(
    "/IPlayerService/GetRecentlyPlayedGames/v0001/",
    { steamid: steamId, count: 10, format: "json" },
  );
  return data.response?.games ?? [];
}

type StoreAppDetails = {
  [appId: string]: {
    success: boolean;
    data?: { genres?: { description: string }[] };
  };
};

export async function fetchGenresForApp(appId: number): Promise<string[]> {
  try {
    const res = await fetch(
      `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=genres`,
      { cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as StoreAppDetails;
    const entry = json[String(appId)];
    if (!entry?.success || !entry.data?.genres) return [];
    return entry.data.genres.map((g) => g.description);
  } catch {
    return [];
  }
}

type AchievementsResponse = {
  playerstats?: {
    achievements?: { achieved: number }[];
  };
};

export async function fetchAchievementSample(
  steamId: string,
  appId: number,
): Promise<{ unlocked: number; total: number } | null> {
  try {
    const data = await steamApiGet<AchievementsResponse>(
      "/ISteamUserStats/GetPlayerAchievements/v0001/",
      { steamid: steamId, appid: appId, format: "json" },
    );
    const list = data.playerstats?.achievements;
    if (!list?.length) return null;
    const unlocked = list.filter((a) => a.achieved === 1).length;
    return { unlocked, total: list.length };
  } catch {
    return null;
  }
}

export function toIconUrl(appId: number, hash?: string): string | null {
  if (!hash) return null;
  return `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${hash}.jpg`;
}

export function mapGameEntry(game: OwnedGame): {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtimeHours: number;
  lastPlayedAt: string | null;
  iconUrl: string | null;
} {
  const minutes = game.playtime_forever ?? 0;
  return {
    appId: game.appid,
    name: game.name ?? `App ${game.appid}`,
    playtimeMinutes: minutes,
    playtimeHours: Math.round((minutes / 60) * 10) / 10,
    lastPlayedAt:
      game.rtime_last_played && game.rtime_last_played > 0
        ? new Date(game.rtime_last_played * 1000).toISOString()
        : null,
    iconUrl: toIconUrl(game.appid, game.img_icon_url),
  };
}
