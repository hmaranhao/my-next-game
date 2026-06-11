import type { NormalizedGame } from "@/types/game";
import { splitGenreTokens } from "./genre-utils";

/** Steam store categories (features/modes), not gameplay genres. */
const STEAM_CATEGORY_TOKENS = new Set(
  [
    "single-player",
    "multi-player",
    "multiplayer",
    "co-op",
    "coop",
    "online co-op",
    "online pvp",
    "local co-op",
    "local multiplayer",
    "local co-op",
    "shared/split screen",
    "shared/split screen co-op",
    "cross-platform multiplayer",
    "mmo",
    "steam achievements",
    "steam cloud",
    "full controller support",
    "partial controller support",
    "steam trading cards",
    "steam workshop",
    "includes level editor",
    "mods",
    "steam turn notifications",
    "steam leaderboards",
    "vr support",
    "vr only",
    "in-app purchases",
    "remote play on phone",
    "remote play on tablet",
    "remote play on tv",
    "remote play together",
    "stats",
    "commentary available",
    "captions available",
    "family sharing",
    "lan co-op",
    "lan pvp",
    "pvp",
    "split screen",
  ].map((s) => s.toLowerCase()),
);

export function normMetadataToken(value: string): string {
  return value.trim().toLowerCase();
}

export function isSteamCategory(token: string): boolean {
  const n = normMetadataToken(token);
  if (!n) return false;
  if (STEAM_CATEGORY_TOKENS.has(n)) return true;
  return (
    n.startsWith("remote play") ||
    n.includes("controller support") ||
    n.endsWith(" co-op") ||
    n.endsWith(" multiplayer")
  );
}

/** Steam genres from the catalog `genre` field. */
export function collectGameGenres(game: NormalizedGame): string[] {
  return splitGenreTokens(game.genre).map(normMetadataToken).filter(Boolean);
}

/** User/community tags excluding Steam categories. */
export function collectGameplayTags(game: NormalizedGame): string[] {
  const genres = new Set(collectGameGenres(game));
  const out: string[] = [];
  for (const tag of game.tags) {
    const n = normMetadataToken(tag);
    if (!n || isSteamCategory(n) || genres.has(n)) continue;
    out.push(n);
  }
  return out;
}

export function collectAnchorGenres(anchors: NormalizedGame[]): Set<string> {
  const genres = new Set<string>();
  for (const anchor of anchors) {
    for (const g of collectGameGenres(anchor)) genres.add(g);
  }
  return genres;
}

/** 0–1 overlap on Steam genres only. */
export function computeGenreOverlapScore(
  anchorGenres: Set<string>,
  candidateGenres: string[],
): number {
  if (!anchorGenres.size || !candidateGenres.length) return 0;

  const normalized = candidateGenres.map(normMetadataToken).filter(Boolean);
  let shared = 0;
  for (const g of normalized) {
    if (anchorGenres.has(g)) shared += 1;
  }
  if (shared === 0) return 0;

  const union = anchorGenres.size + normalized.length - shared;
  const jaccard = union > 0 ? shared / union : 0;
  return Math.min(1, jaccard + shared * 0.12);
}

/** Secondary overlap on filtered user tags (low weight in ranking). */
export function computeGameplayTagOverlap(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  const anchorTags = new Set(collectGameplayTags(anchor));
  const candidateTags = collectGameplayTags(candidate);
  if (!anchorTags.size || !candidateTags.length) return 0;

  let shared = 0;
  for (const t of candidateTags) {
    if (anchorTags.has(t)) shared += 1;
  }
  if (shared === 0) return 0;

  return Math.min(1, shared / Math.max(2, Math.min(anchorTags.size, 8) * 0.5));
}
