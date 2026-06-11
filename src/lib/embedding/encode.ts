import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_LAYOUT as L,
} from "@/types/embedding";
import { type EmbeddingContext, norm } from "./context";
import { ENCODE_WEIGHTS } from "./config";
import { splitGenreTokens } from "./genre-utils";

function zeros(): Float32Array {
  return new Float32Array(EMBEDDING_DIMENSION);
}

function setOneHot(
  vec: Float32Array,
  start: number,
  size: number,
  index: Record<string, number>,
  key: string | null | undefined,
  weight = 1,
) {
  if (!key) return;
  const i = index[key];
  if (i === undefined || i >= size) return;
  vec[start + i] = Math.max(vec[start + i], weight);
}

function setMultiHot(
  vec: Float32Array,
  start: number,
  size: number,
  index: Record<string, number>,
  keys: string[],
  weight = 1,
) {
  for (const key of keys) {
    setOneHot(vec, start, size, index, key, weight);
  }
}

function setContinuous(
  vec: Float32Array,
  offset: number,
  values: number[],
) {
  for (let i = 0; i < values.length && offset + i < L.continuousStart + L.continuousSize; i++) {
    vec[L.continuousStart + i] = values[i];
  }
}

/** Profile preference vector (128-dim, same index space as games). */
export function encodeProfileVector(
  profile: NormalizedUserProfile,
  ctx: EmbeddingContext,
  profileTags: string[] = [],
): Float32Array {
  const vec = zeros();
  const W = ENCODE_WEIGHTS;

  setMultiHot(
    vec,
    L.genreStart,
    L.genreSize,
    ctx.genreIndex,
    profile.inferredGenres,
    W.profileGenre,
  );
  setMultiHot(vec, L.tagStart, L.tagSize, ctx.tagIndex, profileTags, W.profileTag);
  if (profile.steamTags?.length) {
    setMultiHot(
      vec,
      L.tagStart,
      L.tagSize,
      ctx.tagIndex,
      profile.steamTags,
      W.profileTag * 0.45,
    );
  }

  if (profile.source === "STEAM") {
    setOneHot(vec, L.platformStart, L.platformSize, ctx.platformIndex, "PC", 1);
  }

  const playtimeHours = profile.totalPlaytimeMinutes / 60;
  setContinuous(vec, 0, [
    norm(Math.min(playtimeHours, 5000), 0, 5000),
    profile.accountAgeYears != null
      ? norm(profile.accountAgeYears, 0, 20)
      : 0.5,
    profile.source === "STEAM" ? 1 : 0,
    0,
  ]);

  return vec;
}

/**
 * Profile vector from playtime-weighted library games in the catalog.
 * Falls back to genre/tag encoding when no catalog matches exist.
 */
export function encodeProfileVectorFromLibrary(
  profile: NormalizedUserProfile,
  ctx: EmbeddingContext,
  weightedGames: Array<{ game: NormalizedGame; weight: number }>,
  profileTags: string[] = [],
): Float32Array {
  if (!weightedGames.length) {
    return encodeProfileVector(profile, ctx, profileTags);
  }

  const vec = zeros();
  let totalWeight = 0;

  for (const { game, weight } of weightedGames) {
    const gameVec = encodeGameVector(game, ctx);
    totalWeight += weight;
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      vec[i] += gameVec[i] * weight;
    }
  }

  if (totalWeight > 0) {
    for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
      vec[i] /= totalWeight;
    }
  }

  const W = ENCODE_WEIGHTS;
  setMultiHot(vec, L.tagStart, L.tagSize, ctx.tagIndex, profileTags, W.profileTag * 0.5);
  if (profile.steamTags?.length) {
    setMultiHot(vec, L.tagStart, L.tagSize, ctx.tagIndex, profile.steamTags, W.profileTag * 0.35);
  }

  if (profile.source === "STEAM") {
    setOneHot(vec, L.platformStart, L.platformSize, ctx.platformIndex, "PC", 1);
  }

  const playtimeHours = profile.totalPlaytimeMinutes / 60;
  setContinuous(vec, 0, [
    norm(Math.min(playtimeHours, 5000), 0, 5000),
    profile.accountAgeYears != null
      ? norm(profile.accountAgeYears, 0, 20)
      : 0.5,
    profile.source === "STEAM" ? 1 : 0,
    0,
  ]);

  return vec;
}

/** Game catalog vector (128-dim). */
export function encodeGameVector(
  game: NormalizedGame,
  ctx: EmbeddingContext,
): Float32Array {
  const vec = zeros();
  const W = ENCODE_WEIGHTS;

  setMultiHot(
    vec,
    L.genreStart,
    L.genreSize,
    ctx.genreIndex,
    splitGenreTokens(game.genre),
    W.gameGenre,
  );
  setOneHot(
    vec,
    L.platformStart,
    L.platformSize,
    ctx.platformIndex,
    game.platform,
    W.gamePlatform,
  );
  setMultiHot(vec, L.tagStart, L.tagSize, ctx.tagIndex, game.tags, W.gameTag);
  setOneHot(
    vec,
    L.publisherStart,
    L.publisherSize,
    ctx.publisherIndex,
    game.publisher,
    W.gamePublisher,
  );

  setContinuous(vec, 0, [
    game.rating != null ? norm(game.rating, ctx.ratingMin, ctx.ratingMax) : 0.5,
    game.year != null ? norm(game.year, ctx.yearMin, ctx.yearMax) : 0.5,
    game.price != null ? norm(game.price, ctx.priceMin, ctx.priceMax) : 0.5,
    0,
  ]);

  return vec;
}

/**
 * Concatenation profile + game in a single 128-dim vector:
 * element-wise average of profile and game encodings (same index space).
 */
export function encodeProfileGameVector(
  profile: NormalizedUserProfile,
  game: NormalizedGame,
  ctx: EmbeddingContext,
  profileTags: string[] = [],
): Float32Array {
  const p = encodeProfileVector(profile, ctx, profileTags);
  const g = encodeGameVector(game, ctx);
  const out = new Float32Array(EMBEDDING_DIMENSION);
  for (let i = 0; i < EMBEDDING_DIMENSION; i++) {
    out[i] = (p[i] + g[i]) / 2;
  }
  return out;
}

export function vectorToArray(v: Float32Array): number[] {
  return Array.from(v);
}
