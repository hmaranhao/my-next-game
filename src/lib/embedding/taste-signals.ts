import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile, ProfileGameEntry } from "@/types/profile";
import { splitGenreTokens } from "./genre-utils";
import {
  ABANDONED_PLAYTIME_MINUTES,
  entryPlaytimeWeight,
  recencyMultiplier,
} from "./playtime-weights";
import { getProfileLibraryEntries } from "./played-games";
import { findCatalogGame, type GameLookup } from "@/lib/game-lookup";

export type FeedbackRating = "UP" | "DOWN";

export type StoredFeedback = {
  gameExternalId: string;
  rating: FeedbackRating;
  gameMetadata?: NormalizedGame | null;
};

export function getRejectedGameIds(feedback: StoredFeedback[]): Set<string> {
  const latestByGame = new Map<string, FeedbackRating>();

  for (const fb of feedback) {
    if (!latestByGame.has(fb.gameExternalId)) {
      latestByGame.set(fb.gameExternalId, fb.rating);
    }
  }

  const rejected = new Set<string>();
  for (const [gameId, rating] of latestByGame) {
    if (rating === "DOWN") rejected.add(gameId);
  }
  return rejected;
}

export function mergeRejectedGameIds(
  feedback: StoredFeedback[],
  extra: string[] = [],
): Set<string> {
  const rejected = getRejectedGameIds(feedback);
  for (const id of extra) {
    const key = String(id).trim();
    if (key) rejected.add(key);
  }
  return rejected;
}

export type TasteSignals = {
  boostTags: Map<string, number>;
  penalizeTags: Map<string, number>;
  boostGenres: Map<string, number>;
  penalizeGenres: Map<string, number>;
};

function bumpMap(map: Map<string, number>, key: string, delta: number) {
  if (!key.trim()) return;
  map.set(key, (map.get(key) ?? 0) + delta);
}

function absorbGameSignals(
  game: NormalizedGame,
  weight: number,
  targetTags: Map<string, number>,
  targetGenres: Map<string, number>,
) {
  for (const tag of game.tags) {
    bumpMap(targetTags, tag.trim(), weight);
  }
  for (const genre of splitGenreTokens(game.genre)) {
    bumpMap(targetGenres, genre, weight);
  }
}

function isAbandonedLibraryEntry(entry: ProfileGameEntry): boolean {
  const minutes = entry.playtimeMinutes ?? 0;
  if (minutes <= 0 || minutes >= ABANDONED_PLAYTIME_MINUTES) return false;
  return recencyMultiplier(entry.lastPlayedAt) <= 1;
}

export function buildTasteSignals(
  profile: NormalizedUserProfile,
  games: NormalizedGame[],
  lookup: GameLookup,
  feedback: StoredFeedback[] = [],
): TasteSignals {
  const boostTags = new Map<string, number>();
  const penalizeTags = new Map<string, number>();
  const boostGenres = new Map<string, number>();
  const penalizeGenres = new Map<string, number>();

  for (const tag of profile.steamTags ?? []) {
    bumpMap(boostTags, tag, 0.6);
  }
  for (const genre of profile.inferredGenres) {
    bumpMap(boostGenres, genre, 0.5);
  }

  for (const entry of getProfileLibraryEntries(profile)) {
    const game = findCatalogGame(entry.name, entry.appId, lookup, games);
    if (!game) continue;

    if (isAbandonedLibraryEntry(entry)) {
      absorbGameSignals(game, 0.85, penalizeTags, penalizeGenres);
      continue;
    }

    const weight = Math.min(2, entryPlaytimeWeight(entry) / 3);
    absorbGameSignals(game, weight * 0.35, boostTags, boostGenres);
  }

  for (const fb of feedback) {
    const parsedId = Number.parseInt(fb.gameExternalId, 10);
    const game =
      fb.gameMetadata ??
      (Number.isFinite(parsedId)
        ? findCatalogGame("", parsedId, lookup, games)
        : null);
    if (!game) continue;

    if (fb.rating === "DOWN") {
      absorbGameSignals(game, 1.2, penalizeTags, penalizeGenres);
    } else {
      absorbGameSignals(game, 0.9, boostTags, boostGenres);
    }
  }

  return { boostTags, penalizeTags, boostGenres, penalizeGenres };
}

export function applyTasteAdjustment(
  rankScore: number,
  game: NormalizedGame,
  signals: TasteSignals,
): number {
  let delta = 0;

  for (const tag of game.tags) {
    const t = tag.trim();
    delta += (signals.boostTags.get(t) ?? 0) * 0.04;
    delta -= (signals.penalizeTags.get(t) ?? 0) * 0.055;
  }

  for (const genre of splitGenreTokens(game.genre)) {
    delta += (signals.boostGenres.get(genre) ?? 0) * 0.05;
    delta -= (signals.penalizeGenres.get(genre) ?? 0) * 0.06;
  }

  return Math.max(0, Math.min(1, rankScore + delta));
}
