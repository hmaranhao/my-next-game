"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import type { NormalizedUserProfile } from "@/types/profile";

type CandidatePreview = {
  rank: number;
  name: string;
  genre: string | null;
  score: number;
};

export function ProfilePreview({
  profile,
  snapshotId,
}: {
  profile: NormalizedUserProfile;
  snapshotId: string;
}) {
  const t = useTranslations();
  const [candidates, setCandidates] = useState<CandidatePreview[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recommendations/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
        });
        const json = await res.json();
        if (!cancelled && json.ok) {
          setCandidates(
            (json.candidates as CandidatePreview[]).slice(0, 5),
          );
          setElapsedMs(json.elapsedMs as number);
        }
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [snapshotId]);

  return (
    <div className="mt-10 w-full max-w-md space-y-4 text-left">
      <p className="text-center text-sm font-medium text-[var(--gamer-accent)]">
        {t("home.profileReady")}
      </p>
      <div className="rounded-xl border border-border bg-card/80 p-4">
        <div className="flex items-center gap-3">
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatarUrl}
              alt=""
              className="size-12 rounded-full"
            />
          ) : null}
          <div>
            <p className="font-semibold">{profile.displayName}</p>
            <p className="text-xs text-muted-foreground">
              {t("home.gamesPlayed", { count: profile.playedAppIds.length })}
            </p>
          </div>
        </div>
        {profile.inferredGenres.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("home.genres")}
            </p>
            <p className="mt-1 text-sm">{profile.inferredGenres.join(" · ")}</p>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-border bg-card/60 p-4">
        <p className="text-sm font-medium">{t("home.candidatesTitle")}</p>
        {loadingCandidates ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("home.searchingCandidates")}
          </p>
        ) : (
          <>
            {elapsedMs != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("home.candidatesCount", { count: 50, ms: elapsedMs })}
              </p>
            ) : null}
            <ol className="mt-3 space-y-2 text-sm">
              {candidates.map((c) => (
                <li key={c.rank} className="flex justify-between gap-2">
                  <span className="truncate">
                    {c.rank}. {c.name}
                  </span>
                  <span className="shrink-0 text-[var(--gamer-accent)]">
                    {(c.score * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {t("home.nextStep")}
      </p>
    </div>
  );
}
