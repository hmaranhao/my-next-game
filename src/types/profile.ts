/** Normalized profile for embedding / recommendation pipeline */
export type ProfileGameEntry = {
  appId: number;
  name: string;
  playtimeMinutes: number;
  playtimeHours: number;
  lastPlayedAt: string | null;
  iconUrl: string | null;
};

export type NormalizedUserProfile = {
  source: "STEAM" | "MANUAL";
  steamId: string | null;
  displayName: string;
  profileUrl: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  accountCreatedAt: string | null;
  accountAgeYears: number | null;
  isPublic: boolean;
  inferredGenres: string[];
  topGames: ProfileGameEntry[];
  recentGames: ProfileGameEntry[];
  playedAppIds: number[];
  /** Manual-only: game names user says they already played */
  playedGameNames: string[];
  totalPlaytimeMinutes: number;
  achievementSample: {
    appId: number;
    gameName: string;
    unlocked: number;
    total: number;
  } | null;
  rawMeta?: Record<string, unknown>;
};

export type ManualProfileInput = {
  displayName: string;
  favoriteGenres: string[];
  favoriteGames: string[];
  playedGames: string[];
  approximatePlaytimeHours?: number;
  ageRange?: string;
  countryCode?: string;
};

export type ProfileApiSuccess = {
  ok: true;
  snapshotId: string;
  profile: NormalizedUserProfile;
};

export type ProfileApiError = {
  ok: false;
  code:
    | "MISSING_STEAM_API_KEY"
    | "INVALID_INPUT"
    | "PROFILE_PRIVATE"
    | "STEAM_NOT_FOUND"
    | "CONSENT_REQUIRED"
    | "CONSENT_INVALID"
    | "STEAM_API_ERROR";
  message: string;
};
