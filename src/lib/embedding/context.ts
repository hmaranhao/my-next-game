import type { NormalizedGame } from "@/types/game";
import {
  EMBEDDING_DIMENSION,
  EMBEDDING_LAYOUT,
  type EmbeddingContextMeta,
} from "@/types/embedding";

export type EmbeddingContext = EmbeddingContextMeta & {
  genreIndex: Record<string, number>;
  platformIndex: Record<string, number>;
  tagIndex: Record<string, number>;
  publisherIndex: Record<string, number>;
};

const TOP_GENRES = 32;
const TOP_PLATFORMS = 16;
const TOP_TAGS = 16;
const TOP_PUBLISHERS = 8;

function topKeys(counts: Map<string, number>, limit: number): string[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([k]) => k);
}

function bump(map: Map<string, number>, key: string | null | undefined) {
  if (!key?.trim()) return;
  const k = key.trim();
  map.set(k, (map.get(k) ?? 0) + 1);
}

function minMax(values: number[]): { min: number; max: number } {
  if (!values.length) return { min: 0, max: 1 };
  return { min: Math.min(...values), max: Math.max(...values) };
}

function norm(value: number, min: number, max: number): number {
  return (value - min) / (max - min || 1);
}

export function buildEmbeddingContext(games: NormalizedGame[]): EmbeddingContext {
  const genreCounts = new Map<string, number>();
  const platformCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const publisherCounts = new Map<string, number>();

  const ratings: number[] = [];
  const years: number[] = [];
  const prices: number[] = [];

  for (const g of games) {
    bump(genreCounts, g.genre);
    bump(platformCounts, g.platform);
    for (const t of g.tags) bump(tagCounts, t);
    bump(publisherCounts, g.publisher);
    if (g.rating != null) ratings.push(g.rating);
    if (g.year != null) years.push(g.year);
    if (g.price != null) prices.push(g.price);
  }

  const genres = topKeys(genreCounts, TOP_GENRES);
  const platforms = topKeys(platformCounts, TOP_PLATFORMS);
  const tags = topKeys(tagCounts, TOP_TAGS);
  const publishers = topKeys(publisherCounts, TOP_PUBLISHERS);

  const rating = minMax(ratings.length ? ratings : [0, 10]);
  const year = minMax(years.length ? years : [1990, new Date().getFullYear()]);
  const price = minMax(prices.length ? prices : [0, 60]);

  return {
    dimension: EMBEDDING_DIMENSION,
    genres,
    platforms,
    tags,
    publishers,
    ratingMin: rating.min,
    ratingMax: rating.max,
    yearMin: year.min,
    yearMax: year.max,
    priceMin: price.min,
    priceMax: price.max,
    genreIndex: Object.fromEntries(genres.map((g, i) => [g, i])),
    platformIndex: Object.fromEntries(platforms.map((p, i) => [p, i])),
    tagIndex: Object.fromEntries(tags.map((t, i) => [t, i])),
    publisherIndex: Object.fromEntries(publishers.map((p, i) => [p, i])),
  };
}

export { norm };

export function embeddingContextToStored(ctx: EmbeddingContext): EmbeddingContextMeta & {
  genreIndex: Record<string, number>;
  platformIndex: Record<string, number>;
  tagIndex: Record<string, number>;
  publisherIndex: Record<string, number>;
} {
  return {
    dimension: ctx.dimension,
    genres: ctx.genres,
    platforms: ctx.platforms,
    tags: ctx.tags,
    publishers: ctx.publishers,
    ratingMin: ctx.ratingMin,
    ratingMax: ctx.ratingMax,
    yearMin: ctx.yearMin,
    yearMax: ctx.yearMax,
    priceMin: ctx.priceMin,
    priceMax: ctx.priceMax,
    genreIndex: ctx.genreIndex,
    platformIndex: ctx.platformIndex,
    tagIndex: ctx.tagIndex,
    publisherIndex: ctx.publisherIndex,
  };
}

export function embeddingContextFromStored(
  stored: ReturnType<typeof embeddingContextToStored>,
): EmbeddingContext {
  return {
    dimension: stored.dimension,
    genres: stored.genres,
    platforms: stored.platforms,
    tags: stored.tags,
    publishers: stored.publishers,
    ratingMin: stored.ratingMin,
    ratingMax: stored.ratingMax,
    yearMin: stored.yearMin,
    yearMax: stored.yearMax,
    priceMin: stored.priceMin,
    priceMax: stored.priceMax,
    genreIndex: stored.genreIndex,
    platformIndex: stored.platformIndex,
    tagIndex: stored.tagIndex,
    publisherIndex: stored.publisherIndex,
  };
}
