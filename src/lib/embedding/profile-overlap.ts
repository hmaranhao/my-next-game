import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import { splitGenreTokens } from "./genre-utils";

function normTag(tag: string): string {
  return tag.trim().toLowerCase();
}

/** Explicit tag/genre overlap 0–1 between profile taste and a candidate game. */
export function computeProfileGameOverlap(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  profileTags: string[] = [],
): number {
  const profileTagSet = new Set<string>();

  for (const tag of profileTags) profileTagSet.add(normTag(tag));
  for (const tag of profile.steamTags ?? []) profileTagSet.add(normTag(tag));
  for (const genre of profile.inferredGenres) profileTagSet.add(normTag(genre));

  const gameTags = new Set<string>();
  for (const tag of game.tags) {
    const t = normTag(tag);
    if (t) gameTags.add(t);
  }
  for (const genre of splitGenreTokens(game.genre)) {
    gameTags.add(normTag(genre));
  }

  let shared = 0;
  for (const tag of gameTags) {
    if (profileTagSet.has(tag)) shared += 1;
  }

  const profileGenres = profile.inferredGenres.map(normTag);
  const gameGenres = splitGenreTokens(game.genre).map(normTag);
  const sharedGenres = profileGenres.filter((g) => gameGenres.includes(g)).length;

  if (!profileTagSet.size && sharedGenres === 0) return 0;

  const tagOverlap =
    profileTagSet.size > 0
      ? shared / Math.max(2, Math.min(profileTagSet.size, 12) * 0.45)
      : 0;
  const genreOverlap =
    sharedGenres > 0
      ? Math.min(1, 0.35 + sharedGenres * 0.22)
      : 0;

  let score = Math.min(1, tagOverlap * 0.72 + genreOverlap * 0.28);

  if (profile.source === "STEAM" && game.platform?.toLowerCase() === "pc") {
    score = Math.min(1, score + 0.06);
  }

  return score;
}
