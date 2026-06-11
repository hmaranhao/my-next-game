import type { NormalizedGame } from "@/types/game";
import { getSocialMetrics } from "@/lib/catalog/social-metrics";
import {
  hasMajorPublisherHint,
  normPublisherName,
} from "@/lib/catalog/publisher-hints";

export type GameProductionTier = "AAA" | "AA" | "INDIE";

function normStudio(name: string | null | undefined): string {
  return normPublisherName(name);
}

function hasAaaPublisherHint(game: NormalizedGame): boolean {
  return hasMajorPublisherHint(game);
}

/** Classify production scale from owners, reviews and publisher heuristics. */
export function classifyGameTier(game: NormalizedGame): GameProductionTier {
  const { positive, recommendations, ownersMid } = getSocialMetrics(game);
  const combined = positive + recommendations;

  if (
    ownersMid >= 2_000_000 ||
    positive >= 40_000 ||
    recommendations >= 30_000 ||
    combined >= 60_000 ||
    (ownersMid >= 800_000 && hasAaaPublisherHint(game))
  ) {
    return "AAA";
  }

  if (
    ownersMid >= 150_000 ||
    positive >= 5_000 ||
    recommendations >= 5_000 ||
    combined >= 8_000
  ) {
    return "AA";
  }

  return "INDIE";
}

const TIER_ORDER: Record<GameProductionTier, number> = {
  INDIE: 0,
  AA: 1,
  AAA: 2,
};

/** 1 = same tier, ~0.58 one step apart, ~0.22 two steps. */
export function computeTierAffinity(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  const anchorTier = classifyGameTier(anchor);
  const candidateTier = classifyGameTier(candidate);
  const gap = Math.abs(TIER_ORDER[anchorTier] - TIER_ORDER[candidateTier]);

  if (gap === 0) return 1;
  if (gap === 1) return 0.58;
  return 0.22;
}

function studioTokens(game: NormalizedGame): Set<string> {
  const tokens = new Set<string>();
  const pub = normStudio(game.publisher);
  if (pub) tokens.add(pub);
  for (const dev of game.developers ?? []) {
    const d = normStudio(dev);
    if (d) tokens.add(d);
  }
  return tokens;
}

function studiosOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) {
    if (t.length < 3) continue;
    for (const u of b) {
      if (u.length < 3) continue;
      if (t === u || t.includes(u) || u.includes(t)) return true;
    }
  }
  return false;
}

/** Same developer/publisher affinity 0–1. */
export function computeStudioAffinity(
  anchor: NormalizedGame,
  candidate: NormalizedGame,
): number {
  const anchorDevs = new Set(
    (anchor.developers ?? []).map(normStudio).filter(Boolean),
  );
  const candidateDevs = new Set(
    (candidate.developers ?? []).map(normStudio).filter(Boolean),
  );

  for (const d of anchorDevs) {
    for (const c of candidateDevs) {
      if (d === c || (d.length > 4 && c.includes(d)) || (c.length > 4 && d.includes(c))) {
        return 1;
      }
    }
  }

  const anchorPub = normStudio(anchor.publisher);
  const candidatePub = normStudio(candidate.publisher);
  if (anchorPub && candidatePub) {
    if (anchorPub === candidatePub) return 0.85;
    if (anchorPub.includes(candidatePub) || candidatePub.includes(anchorPub)) {
      return 0.7;
    }
  }

  if (studiosOverlap(studioTokens(anchor), studioTokens(candidate))) {
    return 0.55;
  }

  return 0;
}

export function getTierStudioMultiplier(
  anchor: NormalizedGame | null,
  candidate: NormalizedGame,
): number {
  if (!anchor) return 1;

  const tierAffinity = computeTierAffinity(anchor, candidate);
  const studioAffinity = computeStudioAffinity(anchor, candidate);

  let mult = 1;

  if (tierAffinity >= 0.95) mult *= 1.1;
  else if (tierAffinity >= 0.55) mult *= 1.02;
  else mult *= 0.82;

  if (studioAffinity >= 0.99) mult *= 1.12;
  else if (studioAffinity >= 0.8) mult *= 1.07;
  else if (studioAffinity >= 0.5) mult *= 1.03;

  return Math.min(1.22, mult);
}
