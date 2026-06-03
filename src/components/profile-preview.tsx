"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { buildRecommendationExplanation } from "@/lib/ml/explanation";
import {
  WORKER_EVENTS,
  buildTrainingRowsFromPayload,
  fetchTrainingPayload,
  runRecommendationInWorker,
  type WorkerMessage,
  type WorkerRecommendation,
} from "@/lib/ml/worker-client";
import type { NormalizedUserProfile } from "@/types/profile";

type CandidatePreview = {
  rank: number;
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  score: number;
  gameVector: number[];
};

export function ProfilePreview({
  profile,
  snapshotId,
}: {
  profile: NormalizedUserProfile;
  snapshotId: string;
}) {
  const t = useTranslations();
  const workerRef = useRef<Worker | null>(null);
  const [candidates, setCandidates] = useState<CandidatePreview[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [trainProgress, setTrainProgress] = useState<number | null>(null);
  const [trainingEpoch, setTrainingEpoch] = useState<number | null>(null);
  const [recommendation, setRecommendation] = useState<WorkerRecommendation | null>(
    null,
  );
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [explanationValues, setExplanationValues] = useState<
    Record<string, string | number>
  >({});
  const [mlError, setMlError] = useState<string | null>(null);

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
        if (cancelled || !json.ok) return;

        const list = json.candidates as CandidatePreview[];
        setCandidates(list.slice(0, 5));
        setElapsedMs(json.elapsedMs as number);

        const training = await fetchTrainingPayload();
        if (cancelled) return;

        const trainingRows = buildTrainingRowsFromPayload(
          training.pairs,
          training.gameVectors,
        );

        const allCandidates = (json.candidates as CandidatePreview[]).map((c) => ({
          gameId: c.gameId,
          name: c.name,
          genre: c.genre,
          platform: c.platform,
          rating: c.rating,
          gameVector: c.gameVector,
        }));

        workerRef.current = runRecommendationInWorker({
          profileVector: json.queryVector as number[],
          candidates: allCandidates,
          trainingRows,
          onMessage: (msg: WorkerMessage) => {
            if (cancelled) return;
            if (msg.type === WORKER_EVENTS.progress) {
              setTrainProgress(msg.progress);
            }
            if (msg.type === WORKER_EVENTS.trainingLog) {
              setTrainingEpoch(msg.epoch + 1);
            }
            if (msg.type === WORKER_EVENTS.complete) {
              setRecommendation(msg.recommendation);
              const gameMeta = allCandidates.find(
                (c) => c.gameId === msg.recommendation.gameId,
              );
              const explain = buildRecommendationExplanation(
                profile,
                {
                  id: msg.recommendation.gameId,
                  name: msg.recommendation.name,
                  genre: msg.recommendation.genre,
                  platform: msg.recommendation.platform,
                  year: null,
                  rating: msg.recommendation.rating,
                  tags: [],
                  price: null,
                  publisher: null,
                  raw: {},
                },
                msg.recommendation.matchPercent,
              );
              setExplanationKey(explain.explanationKey);
              setExplanationValues(explain.explanationValues);
              if (!gameMeta) return;
            }
            if (msg.type === WORKER_EVENTS.error) {
              setMlError(msg.message);
            }
          },
        });
      } catch (err) {
        if (!cancelled) {
          setMlError(err instanceof Error ? err.message : "ML error");
        }
      } finally {
        if (!cancelled) setLoadingCandidates(false);
      }
    })();

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, [snapshotId, profile]);

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

      <div className="rounded-xl border border-[var(--gamer-accent)]/40 bg-card/80 p-4">
        <p className="text-sm font-medium">{t("recommendation.title")}</p>
        {trainProgress != null && trainProgress < 100 && !recommendation ? (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              {t("recommendation.training", { progress: trainProgress })}
            </p>
            {trainingEpoch != null ? (
              <p className="text-xs text-muted-foreground">
                {t("recommendation.epoch", { epoch: trainingEpoch })}
              </p>
            ) : null}
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-[var(--gamer-accent)] transition-all"
                style={{ width: `${trainProgress}%` }}
              />
            </div>
          </div>
        ) : null}
        {mlError ? (
          <p className="mt-2 text-xs text-destructive">{mlError}</p>
        ) : null}
        {recommendation ? (
          <div className="mt-3 space-y-2">
            <p className="text-lg font-semibold">{recommendation.name}</p>
            <p className="text-2xl font-bold text-[var(--gamer-accent)]">
              {t("recommendation.match", { percent: recommendation.matchPercent })}
            </p>
            {explanationKey ? (
              <p className="text-sm text-muted-foreground">
                {t(explanationKey as "recommendation.explainGeneric", explanationValues)}
              </p>
            ) : null}
          </div>
        ) : !mlError && trainProgress == null && !loadingCandidates ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("recommendation.waiting")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
