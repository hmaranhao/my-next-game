import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import {
  collectAnchorGenres,
  collectGameGenres,
  collectGameplayTags,
  computeGenreOverlapScore,
  isSteamCategory,
  normMetadataToken,
} from "./steam-metadata-utils";

/** Explicit genre-first overlap 0–1 between profile taste and a candidate game. */
export function computeProfileGameOverlap(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  profileTags: string[] = [],
  anchorGames: NormalizedGame[] = [],
): number {
  const candidateGenres = collectGameGenres(game);
  const anchorGenres =
    anchorGames.length > 0
      ? collectAnchorGenres(anchorGames)
      : new Set(profile.inferredGenres.map(normMetadataToken));

  const anchorGenreOverlap = computeGenreOverlapScore(
    anchorGenres,
    candidateGenres,
  );

  const profileGenres = profile.inferredGenres.map(normMetadataToken);
  const libraryGenreOverlap = computeGenreOverlapScore(
    new Set(profileGenres),
    candidateGenres,
  );

  const profileTagSet = new Set<string>();
  for (const tag of profileTags) {
    const n = normMetadataToken(tag);
    if (!n || isSteamCategory(n)) continue;
    profileTagSet.add(n);
  }
  for (const genre of profile.inferredGenres) {
    profileTagSet.add(normMetadataToken(genre));
  }

  const gameTags = new Set(collectGameplayTags(game));
  let sharedTags = 0;
  for (const tag of gameTags) {
    if (profileTagSet.has(tag)) sharedTags += 1;
  }

  const tagOverlap =
    profileTagSet.size > 0 && sharedTags > 0
      ? Math.min(1, sharedTags / Math.max(2, Math.min(profileTagSet.size, 10) * 0.45))
      : 0;

  let score = Math.min(
    1,
    anchorGenreOverlap * 0.72 +
      libraryGenreOverlap * 0.18 +
      tagOverlap * 0.1,
  );

  if (anchorGenres.size > 0 && anchorGenreOverlap === 0) {
    score *= 0.35;
  }

  if (profile.source === "STEAM" && game.platform?.toLowerCase() === "pc") {
    score = Math.min(1, score + 0.04);
  }

  return score;
}
