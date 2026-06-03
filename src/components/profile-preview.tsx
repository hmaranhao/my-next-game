"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GameDetailCard } from "@/components/game-detail-card";
import { buildRecommendationExplanation } from "@/lib/ml/explanation";
import { pickHybridRecommendation, scoreAllHybrid } from "@/lib/ml/rank-candidates";
import {
  WORKER_EVENTS,
  buildTrainingRowsFromPayload,
  fetchTrainingPayload,
  runRecommendationInWorker,
  type WorkerMessage,
} from "@/lib/ml/worker-client";
import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";

type CandidatePreview = {
  rank: number;
  gameId: string;
  name: string;
  genre: string | null;
  platform: string | null;
  rating: number | null;
  score: number;
  vectorScore?: number;
  popularityScore?: number;
  gameVector: number[];
  metadata: NormalizedGame;
  /** Set after TF.js — same value shown on final card */
  matchPercent?: number;
};

export function ProfilePreview({
  profile,
  snapshotId,
  onReset,
}: {
  profile: NormalizedUserProfile;
  snapshotId: string;
  onReset: () => void;
}) {
  const t = useTranslations();
  const workerRef = useRef<Worker | null>(null);
  const [candidates, setCandidates] = useState<CandidatePreview[]>([]);
  const [elapsedMs, setElapsedMs] = useState<number | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [trainProgress, setTrainProgress] = useState<number | null>(null);
  const [trainingEpoch, setTrainingEpoch] = useState<number | null>(null);
  const [pickedGame, setPickedGame] = useState<NormalizedGame | null>(null);
  const [mlComplete, setMlComplete] = useState(false);
  const [explanationKey, setExplanationKey] = useState<string | null>(null);
  const [explanationValues, setExplanationValues] = useState<
    Record<string, string | number>
  >({});
  const [candidatePoolSize, setCandidatePoolSize] = useState(1000);
  const [useSampleCatalog, setUseSampleCatalog] = useState(false);
  const [finalPickTopN, setFinalPickTopN] = useState(10);
  const [pickedGameId, setPickedGameId] = useState<string | null>(null);
  const [mlError, setMlError] = useState<string | null>(null);

  const chosenCandidate = candidates.find((c) => c.gameId === pickedGameId);
  const chosenMatchPercent = chosenCandidate?.matchPercent ?? null;

  const sortedCandidates = useMemo(() => {
    return [...candidates]
      .map((c) => {
        const isChosen = pickedGameId === c.gameId;
        const displayPercent =
          isChosen && chosenMatchPercent != null
            ? chosenMatchPercent
            : c.matchPercent ?? Math.round(c.score * 100);
        return { ...c, displayPercent };
      })
      .sort((a, b) => b.displayPercent - a.displayPercent);
  }, [candidates, pickedGameId, chosenMatchPercent]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/recommendations/candidates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ snapshotId }),
        });
        const raw = await res.text();
        let json: Record<string, unknown>;
        try {
          json = JSON.parse(raw) as Record<string, unknown>;
        } catch {
          if (!cancelled) {
            setMlError(
              res.ok
                ? t("errors.invalidApiResponse")
                : t("errors.candidatesUnavailable"),
            );
          }
          return;
        }
        if (cancelled || !json.ok) {
          if (!cancelled && typeof json.message === "string") setMlError(json.message);
          return;
        }

        const list = json.candidates as CandidatePreview[];
        const pickTopN = (json.finalPickTopN as number) ?? 10;
        setFinalPickTopN(pickTopN);
        setCandidates(list.slice(0, pickTopN));
        setElapsedMs(json.elapsedMs as number);
        setCandidatePoolSize((json.candidatePoolSize as number) ?? list.length);
        setUseSampleCatalog(Boolean(json.useSampleCatalog));

        const training = await fetchTrainingPayload();
        if (cancelled) return;

        const trainingRows = buildTrainingRowsFromPayload(
          training.pairs,
          training.gameVectors,
        );

        /** TF.js + escolha final apenas entre os top-N do ranking vetorial */
        const finalPool = list.slice(0, pickTopN);
        const allCandidates = finalPool.map((c) => ({
          gameId: c.gameId,
          name: c.name,
          genre: c.genre,
          platform: c.platform,
          rating: c.rating,
          gameVector: c.gameVector,
          vectorScore: c.vectorScore ?? c.score,
          rankScore: c.score,
          popularityScore: c.popularityScore ?? c.metadata?.popularityScore ?? 0,
        }));

        const metadataById = new Map(finalPool.map((c) => [c.gameId, c.metadata]));
        const poolSize = json.candidatePoolSize as number;

        workerRef.current = runRecommendationInWorker({
          profileVector: json.queryVector as number[],
          playedGameWeightedVector:
            (json.playedGameWeightedVector as number[] | null) ?? null,
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
              const tfMap = new Map(
                msg.predictions.map((p) => [p.gameId, p.tfScore]),
              );
              const scored = scoreAllHybrid(allCandidates, tfMap);
              const pick = pickHybridRecommendation(allCandidates, tfMap);
              if (!pick) return;

              const percentById = new Map(
                scored.map((s) => [String(s.gameId), s.matchPercent]),
              );

              setCandidates((prev) =>
                prev.map((c) => ({
                  ...c,
                  matchPercent: percentById.get(String(c.gameId)),
                })),
              );
              setMlComplete(true);

              const meta = metadataById.get(pick.gameId);
              if (meta) setPickedGame(meta);
              setPickedGameId(pick.gameId);

              const explain = buildRecommendationExplanation(
                profile,
                meta ?? {
                  id: pick.gameId,
                  steamAppId: Number.parseInt(pick.gameId, 10) || null,
                  name: pick.name,
                  genre: pick.genre,
                  platform: pick.platform,
                  year: null,
                  rating: pick.rating,
                  tags: [],
                  price: null,
                  publisher: null,
                  raw: {},
                },
                pick.matchPercent,
                poolSize,
              );
              setExplanationKey(explain.explanationKey);
              setExplanationValues(explain.explanationValues);
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
    <div className="mx-auto mt-10 w-full max-w-2xl space-y-4 text-left">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--gamer-accent)]">
          {t("home.profileReady")}
        </p>
        <Button type="button" variant="outline" size="sm" onClick={onReset}>
          {t("home.searchAnother")}
        </Button>
      </div>

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
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("home.candidatesFinalPool", { count: finalPickTopN })}
        </p>
        {loadingCandidates ? (
          <p className="mt-2 text-xs text-muted-foreground">
            {t("home.searchingCandidates")}
          </p>
        ) : (
          <>
            {elapsedMs != null ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("home.candidatesCount", { count: candidatePoolSize, ms: elapsedMs })}
              </p>
            ) : null}
            {useSampleCatalog ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                {t("home.candidatesSampleHint", { total: candidatePoolSize })}
              </p>
            ) : null}
            {candidates.length > 0 && candidates.length < finalPickTopN ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("home.candidatesLimitedPool", {
                  shown: candidates.length,
                  target: finalPickTopN,
                })}
              </p>
            ) : null}
            {mlComplete ? (
              <p className="mt-1 text-xs text-muted-foreground">
                {t("home.candidatesHybridHint")}
              </p>
            ) : null}
            <ol className="mt-3 space-y-3">
              {sortedCandidates.map((c, index) => {
                const isChosen = pickedGameId === c.gameId;
                const percentLabel =
                  mlComplete && (c.matchPercent != null || isChosen)
                    ? "match"
                    : "ranking";

                return (
                <li
                  key={c.gameId}
                  className={`flex gap-3 rounded-lg p-2 text-sm ${
                    isChosen
                      ? "border border-[var(--gamer-accent)]/50 bg-[var(--gamer-accent)]/10"
                      : ""
                  }`}
                >
                  {c.metadata.headerImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.metadata.headerImage}
                      alt=""
                      className="size-14 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="size-14 shrink-0 rounded-lg bg-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {index + 1}. {c.name}
                      {isChosen ? (
                        <span className="ml-2 text-xs font-normal text-[var(--gamer-accent)]">
                          {t("home.chosenBadge")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {percentLabel === "match"
                        ? t("home.matchPercent", { percent: c.displayPercent })
                        : t("home.rankPercent", { percent: c.displayPercent })}{" "}
                      · {c.metadata.genre ?? "—"}
                    </p>
                  </div>
                </li>
              );
              })}
            </ol>
          </>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t("recommendation.title")}</p>
        {trainProgress != null && trainProgress < 100 && !pickedGame ? (
          <div className="space-y-2 rounded-xl border border-border bg-card/60 p-4">
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
          <p className="text-xs text-destructive">{mlError}</p>
        ) : null}
        {pickedGame ? (
          <GameDetailCard
            game={pickedGame}
            matchPercent={chosenMatchPercent ?? undefined}
            explanation={
              explanationKey
                ? t(explanationKey as "recommendation.explainGeneric", explanationValues)
                : null
            }
          />
        ) : !mlError && trainProgress == null && !loadingCandidates ? (
          <p className="text-xs text-muted-foreground">{t("recommendation.waiting")}</p>
        ) : null}
      </div>
    </div>
  );
}
