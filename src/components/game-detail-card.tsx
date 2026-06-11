"use client";

import { useTranslations } from "next-intl";
import type { NormalizedGame } from "@/types/game";
import { steamStoreUrl } from "@/types/game";
import { GameCoverImage } from "@/components/game-cover-image";

type Props = {
  game: NormalizedGame;
  matchPercent?: number;
  explanation?: string | null;
  compact?: boolean;
};

export function GameDetailCard({ game, matchPercent, explanation, compact }: Props) {
  const t = useTranslations("game");

  const positive =
    game.positiveReviews ?? Number(game.raw?.positive ?? 0);
  const recommendations =
    game.recommendations ?? Number(game.raw?.recommendations ?? 0);

  return (
    <article className="overflow-hidden rounded-xl border border-border bg-card/90">
      <GameCoverImage
        src={game.headerImage}
        className="h-40 w-full object-cover sm:h-48"
      />

      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className={`font-semibold ${compact ? "text-lg" : "text-xl"}`}>
            {game.name}
          </h3>
          {matchPercent != null ? (
            <span className="rounded-full bg-[var(--gamer-accent)]/15 px-3 py-1 text-sm font-bold text-[var(--gamer-accent)]">
              {matchPercent}%
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          {game.genre ? (
            <span className="rounded-md border border-border px-2 py-0.5">{game.genre}</span>
          ) : null}
          {game.platform ? (
            <span className="rounded-md border border-border px-2 py-0.5">
              {game.platform}
            </span>
          ) : null}
          {game.year ? (
            <span className="rounded-md border border-border px-2 py-0.5">
              {game.year}
            </span>
          ) : null}
          {game.price != null && game.price > 0 ? (
            <span className="rounded-md border border-border px-2 py-0.5">
              ${game.price.toFixed(2)}
            </span>
          ) : game.price === 0 ? (
            <span className="rounded-md border border-border px-2 py-0.5">
              {t("free")}
            </span>
          ) : null}
          {game.rating != null ? (
            <span className="rounded-md border border-border px-2 py-0.5">
              ★ {game.rating.toFixed(1)}/10
            </span>
          ) : null}
        </div>

        {positive > 0 ? (
          <p className="text-xs text-muted-foreground">
            {t("reviews", {
              positive: positive.toLocaleString(),
              recommendations: recommendations.toLocaleString(),
            })}
          </p>
        ) : null}

        {game.estimatedOwners ? (
          <p className="text-xs text-muted-foreground">
            {t("owners", { range: game.estimatedOwners })}
          </p>
        ) : null}

        {game.developers?.length ? (
          <p className="text-xs text-muted-foreground">
            {t("developer")}: {game.developers.join(", ")}
          </p>
        ) : null}

        {game.shortDescription && !compact ? (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {game.shortDescription}
          </p>
        ) : null}

        {game.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {game.tags.slice(0, compact ? 6 : 10).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        {game.screenshots && game.screenshots.length > 0 && !compact ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {game.screenshots.map((url) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={url}
                src={url}
                alt=""
                className="h-20 w-36 shrink-0 rounded-lg object-cover"
              />
            ))}
          </div>
        ) : null}

        {explanation ? (
          <p className="text-sm text-muted-foreground">{explanation}</p>
        ) : null}

        <a
          href={steamStoreUrl(game)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex text-sm font-medium text-[var(--gamer-accent)] hover:underline"
        >
          {t("viewOnSteam")} →
        </a>
      </div>
    </article>
  );
}
