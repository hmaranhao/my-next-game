import type { NormalizedUserProfile } from "@/types/profile";

function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\breview\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Stable key so manual-profile feedback survives new snapshots. */
export function profileFeedbackKey(profile: NormalizedUserProfile): string {
  if (profile.steamId) return profile.steamId;

  const ids = [...profile.playedAppIds].sort((a, b) => a - b).join(",");
  const names = profile.playedGameNames
    .map((n) => normalizeGameName(n))
    .filter(Boolean)
    .sort()
    .join("|");

  return `manual:${ids}|${names}`.slice(0, 240);
}
