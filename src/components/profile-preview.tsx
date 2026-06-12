"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GameDetailCard } from "@/components/game-detail-card";
import { GameCoverImage } from "@/components/game-cover-image";
import { buildRecommendationExplanation } from "@/lib/ml/explanation";
import { pickHybridRecommendation, scoreAllHybrid, calibrateRankScoresToMatchPercent } from "@/lib/ml/rank-candidates";
import {
  WORKER_EVENTS,
  buildTrainingRowsFromPayload,
  fetchTrainingPayload,
  runRecommendationInWorker,
  type WorkerMessage,
} from "@/lib/ml/worker-client";
import {
  TfTrainingDrawer,
  type TrainingLogEntry,
} from "@/components/tf-training-drawer";
import {
  loadPersistedTrainingLogs,
  persistTrainingLogs,
} from "@/lib/ml/training-log-store";
import type { NormalizedGame } from "@/types/game";
import type { NormalizedUserProfile } from "@/types/profile";

type AnchorGamePreview = {
  name: string;
  playtimeHours: number;
  tier: "AAA" | "AA" | "INDIE" | null;
};

const VISIBLE_CANDIDATES = 3;

function addRejectedGame(
  set: Set<string>,
  game: Pick<NormalizedGame, "id" | "steamAppId">,
) {
  set.add(String(game.id));
  if (game.steamAppId != null) set.add(String(game.steamAppId));
}

function isCandidateRejected(
  gameId: string,
  metadata: NormalizedGame | undefined,
  rejected: Set<string>,
): boolean {
  if (rejected.has(String(gameId))) return true;
  if (metadata?.steamAppId != null && rejected.has(String(metadata.steamAppId))) {
    return true;
  }
  return false;
}

function filterRejectedCandidates<
  T extends { gameId: string; metadata?: NormalizedGame },
>(items: T[], rejected: Set<string>): T[] {
  return items.filter((c) => !isCandidateRejected(c.gameId, c.metadata, rejected));
}

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
  anchorAffinity?: number;
  gameVector: number[];
  metadata: NormalizedGame;
  matchPercent?: number;
};

function resetRecommendationState(setters: {
  setCandidates: (v: CandidatePreview[]) => void;
  setElapsedMs: (v: number | null) => void;
  setTrainProgress: (v: number | null) => void;
  setTrainingEpoch: (v: number | null) => void;
  setPickedGame: (v: NormalizedGame | null) => void;
  setMlComplete: (v: boolean) => void;
  setExplanationKey: (v: string | null) => void;
  setExplanationValues: (v: Record<string, string | number>) => void;
  setPickedGameId: (v: string | null) => void;
  setSessionId: (v: string | null) => void;
  setFeedbackSent: (v: "UP" | "DOWN" | null) => void;
  setMlError: (v: string | null) => void;
  setShowAllCandidates: (v: boolean) => void;
}) {
  setters.setCandidates([]);
  setters.setElapsedMs(null);
  setters.setTrainProgress(null);
  setters.setTrainingEpoch(null);
  setters.setPickedGame(null);
  setters.setMlComplete(false);
  setters.setExplanationKey(null);
  setters.setExplanationValues({});
  setters.setPickedGameId(null);
  setters.setSessionId(null);
  setters.setFeedbackSent(null);
  setters.setMlError(null);
  setters.setShowAllCandidates(false);
}

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
  const rejectedGameIdsRef = useRef<Set<string>>(new Set());
  const pipelineOptionsRef = useRef<{ ignoreFeedback?: boolean }>({});
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
  const [finalPickTopN, setFinalPickTopN] = useState(30);
  const [pickedGameId, setPickedGameId] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [feedbackSent, setFeedbackSent] = useState<"UP" | "DOWN" | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [mlError, setMlError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [showAllCandidates, setShowAllCandidates] = useState(false);
  const [anchorTier, setAnchorTier] = useState<"AAA" | "AA" | "INDIE" | null>(
    null,
  );
  const [showRetryCandidates, setShowRetryCandidates] = useState(false);
  const [anchorGames, setAnchorGames] = useState<AnchorGamePreview[]>([]);
  const [trainingLogs, setTrainingLogs] = useState<TrainingLogEntry[]>([]);
  const [modelFromCache, setModelFromCache] = useState(false);
  const [trainingDrawerOpen, setTrainingDrawerOpen] = useState(false);

  const showTrainingButton = trainingLogs.length > 0;

  const chosenCandidate = candidates.find((c) => c.gameId === pickedGameId);
  const chosenMatchPercent = chosenCandidate?.matchPercent ?? null;

  const rankPercentById = useMemo(
    () =>
      calibrateRankScoresToMatchPercent(
        candidates.map((c) => ({
          gameId: c.gameId,
          name: c.name,
          genre: c.genre,
          platform: c.platform,
          rating: c.rating,
          vectorScore: c.vectorScore ?? c.score,
          rankScore: c.score,
        })),
      ),
    [candidates],
  );

  const sortedCandidates = useMemo(() => {
    return [...candidates]
      .map((c) => {
        const isChosen = pickedGameId === c.gameId;
        const displayPercent =
          isChosen && chosenMatchPercent != null
            ? chosenMatchPercent
            : c.matchPercent ??
              rankPercentById.get(String(c.gameId)) ??
              Math.round(c.score * 100);
        return { ...c, displayPercent };
      })
      .sort((a, b) => b.displayPercent - a.displayPercent);
  }, [candidates, pickedGameId, chosenMatchPercent, rankPercentById]);

  const visibleCandidates = showAllCandidates
    ? sortedCandidates
    : sortedCandidates.slice(0, VISIBLE_CANDIDATES);

  const runPipeline = useCallback(async (cancelled: () => boolean) => {
    resetRecommendationState({
      setCandidates,
      setElapsedMs,
      setTrainProgress,
      setTrainingEpoch,
      setPickedGame,
      setMlComplete,
      setExplanationKey,
      setExplanationValues,
      setPickedGameId,
      setSessionId,
      setFeedbackSent,
      setMlError,
      setShowAllCandidates,
    });
    setAnchorTier(null);
    setAnchorGames([]);
    setTrainingLogs([]);
    setModelFromCache(false);
    setTrainingDrawerOpen(false);
    setShowRetryCandidates(false);

    try {
      const pipelineOpts = pipelineOptionsRef.current;
      pipelineOptionsRef.current = {};
      if (pipelineOpts.ignoreFeedback) {
        rejectedGameIdsRef.current.clear();
      }

      const excludeGameIds = pipelineOpts.ignoreFeedback
        ? []
        : [...rejectedGameIdsRef.current];
      const res = await fetch("/api/recommendations/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          snapshotId,
          excludeGameIds,
          ignoreFeedback: pipelineOpts.ignoreFeedback === true,
        }),
      });
      const raw = await res.text();
      let json: Record<string, unknown>;
      try {
        json = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        if (!cancelled()) {
          setMlError(
            res.ok
              ? t("errors.invalidApiResponse")
              : t("errors.candidatesUnavailable"),
          );
        }
        return;
      }
      if (cancelled() || !json.ok) {
        if (!cancelled() && typeof json.message === "string") setMlError(json.message);
        return;
      }

      for (const id of (json.rejectedGameIds as string[] | undefined) ?? []) {
        rejectedGameIdsRef.current.add(String(id));
      }

      const rejected = rejectedGameIdsRef.current;
      const rawList = json.candidates as CandidatePreview[];
      const list = filterRejectedCandidates(rawList, rejected);
      const pickTopN = (json.finalPickTopN as number) ?? 30;

      if (!list.length) {
        if (!cancelled()) {
          const hadRejections =
            excludeGameIds.length > 0 ||
            ((json.rejectedGameIds as string[] | undefined)?.length ?? 0) > 0;
          setMlError(
            t(
              hadRejections
                ? "errors.noCandidatesAfterFeedback"
                : "errors.noCandidatesEmptyPool",
            ),
          );
          setShowRetryCandidates(true);
        }
        return;
      }

      setFinalPickTopN(pickTopN);
      setCandidates(list.slice(0, pickTopN));
      setElapsedMs(json.elapsedMs as number);
      setSessionId((json.sessionId as string) ?? null);
      setCandidatePoolSize((json.candidatePoolSize as number) ?? list.length);
      setUseSampleCatalog(Boolean(json.useSampleCatalog));
      const resolvedAnchorTier =
        (json.anchorTier as "AAA" | "AA" | "INDIE" | null | undefined) ?? null;
      setAnchorTier(resolvedAnchorTier);
      setAnchorGames(
        (json.anchorGames as AnchorGamePreview[] | undefined) ?? [],
      );

      const training = await fetchTrainingPayload();
      if (cancelled()) return;

      const trainingRows = buildTrainingRowsFromPayload(
        training.pairs,
        training.gameVectors,
      );

      const finalPool = filterRejectedCandidates(list.slice(0, pickTopN), rejected);
      if (!finalPool.length) {
        if (!cancelled()) {
          const hadRejections = excludeGameIds.length > 0;
          setMlError(
            t(
              hadRejections
                ? "errors.noCandidatesAfterFeedback"
                : "errors.noCandidatesEmptyPool",
            ),
          );
          setShowRetryCandidates(true);
        }
        return;
      }

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
        anchorAffinity: c.anchorAffinity,
      }));

      const metadataById = new Map(finalPool.map((c) => [c.gameId, c.metadata]));
      const poolSize = json.candidatePoolSize as number;

      workerRef.current?.terminate();
      workerRef.current = runRecommendationInWorker({
        profileVector: json.queryVector as number[],
        playedGameWeightedVector:
          (json.playedGameWeightedVector as number[] | null) ?? null,
        candidates: allCandidates,
        trainingRows,
        onMessage: (msg: WorkerMessage) => {
          if (cancelled()) return;
          if (msg.type === WORKER_EVENTS.progress) {
            setTrainProgress(msg.progress);
          }
          if (msg.type === WORKER_EVENTS.modelCached) {
            setModelFromCache(true);
            setTrainingLogs((prev) => {
              if (prev.length) return prev;
              return loadPersistedTrainingLogs();
            });
          }
          if (msg.type === WORKER_EVENTS.trainingLog) {
            setModelFromCache(false);
            setTrainingEpoch(msg.epoch + 1);
            setTrainingLogs((prev) => {
              const next = [
                ...prev,
                {
                  epoch: msg.epoch,
                  loss: msg.loss,
                  accuracy: msg.accuracy ?? 0,
                },
              ];
              persistTrainingLogs(next);
              return next;
            });
            setTrainingDrawerOpen(true);
          }
          if (msg.type === WORKER_EVENTS.complete) {
            const tfMap = new Map(
              msg.predictions.map((p) => [p.gameId, p.tfScore]),
            );
            const eligible = allCandidates.filter(
              (c) => !isCandidateRejected(c.gameId, metadataById.get(c.gameId), rejected),
            );
            const scored = scoreAllHybrid(eligible, tfMap);
            const pick = pickHybridRecommendation(eligible, tfMap);
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
              resolvedAnchorTier,
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
      if (!cancelled()) {
        setMlError(err instanceof Error ? err.message : "ML error");
      }
    } finally {
      if (!cancelled()) setLoadingCandidates(false);
    }
  }, [profile, snapshotId, t]);

  useEffect(() => {
    let cancelled = false;
    setLoadingCandidates(true);
    void runPipeline(() => cancelled);

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
    };
  }, [runPipeline, reloadNonce]);

  function retryCandidatesFresh() {
    pipelineOptionsRef.current = { ignoreFeedback: true };
    setMlError(null);
    setLoadingCandidates(true);
    workerRef.current?.terminate();
    setReloadNonce((n) => n + 1);
  }

  async function sendFeedback(rating: "UP" | "DOWN") {
    if (!sessionId || !pickedGame || feedbackLoading) return;
    if (rating === "UP" && feedbackSent) return;

    setFeedbackLoading(true);
    try {
      if (rating === "DOWN") {
        addRejectedGame(rejectedGameIdsRef.current, pickedGame);
      }

      const res = await fetch("/api/recommendations/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          sessionId,
          snapshotId,
          gameExternalId: pickedGame.id,
          rating,
          gameMetadata: pickedGame,
        }),
      });
      const json = await res.json();
      if (!json.ok) return;

      if (rating === "UP") {
        setFeedbackSent("UP");
        return;
      }

      setFeedbackSent("DOWN");
      setLoadingCandidates(true);
      workerRef.current?.terminate();
      setReloadNonce((n) => n + 1);
    } finally {
      setFeedbackLoading(false);
    }
  }

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
        {anchorGames.length > 0 ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("home.anchorGamesTitle")}
            </p>
            <ul className="mt-1 space-y-1">
              {anchorGames.map((anchor) => (
                <li key={anchor.name} className="text-sm font-medium">
                  {anchor.name}
                  {anchor.playtimeHours > 0 ? (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {t("home.lastPlayedHours", { hours: anchor.playtimeHours })}
                    </span>
                  ) : null}
                  {anchor.tier ? (
                    <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                      {t("home.lastPlayedTier", { tier: anchor.tier })}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : profile.lastPlayedGame ? (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {t("home.lastPlayed")}
            </p>
            <p className="mt-1 text-sm font-medium">
              {profile.lastPlayedGame.name}
              {profile.lastPlayedGame.playtimeHours > 0 ? (
                <span className="ml-2 font-normal text-muted-foreground">
                  {t("home.lastPlayedHours", {
                    hours: profile.lastPlayedGame.playtimeHours,
                  })}
                </span>
              ) : null}
            </p>
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
              {visibleCandidates.map((c, index) => {
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
                  <GameCoverImage
                    src={c.metadata.headerImage}
                    className="size-14 shrink-0 rounded-lg object-cover"
                    compact
                  />
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
            {sortedCandidates.length > VISIBLE_CANDIDATES ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => setShowAllCandidates((v) => !v)}
              >
                {showAllCandidates
                  ? t("home.showFewerCandidates")
                  : t("home.showAllCandidates", { count: sortedCandidates.length })}
              </Button>
            ) : null}
          </>
        )}
      </div>

      <div className="space-y-3">
        <p className="text-sm font-medium">{t("recommendation.title")}</p>
        {showTrainingButton ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-testid="open-training-drawer"
            onClick={() => setTrainingDrawerOpen(true)}
          >
            {t("recommendation.openTrainingDrawer")}
          </Button>
        ) : null}
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
          <div className="space-y-2 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
            <p className="text-xs text-destructive">{mlError}</p>
            {showRetryCandidates ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={retryCandidatesFresh}
              >
                {t("errors.retryCandidates")}
              </Button>
            ) : null}
          </div>
        ) : null}
        {pickedGame ? (
          <>
            <GameDetailCard
              game={pickedGame}
              matchPercent={chosenMatchPercent ?? undefined}
              explanation={
                explanationKey
                  ? t(explanationKey as "recommendation.explainGeneric", explanationValues)
                  : null
              }
            />
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card/60 p-4">
              <p className="text-sm font-medium">{t("feedback.prompt")}</p>
              {feedbackSent === "UP" ? (
                <p className="text-xs text-muted-foreground">
                  {t("feedback.thanksUp")}
                </p>
              ) : feedbackSent === "DOWN" && loadingCandidates ? (
                <p className="text-xs text-muted-foreground">
                  {t("feedback.thanksDown")}
                </p>
              ) : (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="gamer-cta flex-1"
                    disabled={feedbackLoading || loadingCandidates}
                    onClick={() => sendFeedback("UP")}
                  >
                    {t("feedback.up")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    disabled={feedbackLoading || loadingCandidates}
                    onClick={() => sendFeedback("DOWN")}
                  >
                    {t("feedback.down")}
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : !mlError && trainProgress == null && !loadingCandidates ? (
          <p className="text-xs text-muted-foreground">{t("recommendation.waiting")}</p>
        ) : null}
      </div>

      <TfTrainingDrawer
        open={trainingDrawerOpen}
        onOpenChange={setTrainingDrawerOpen}
        logs={trainingLogs}
        modelFromCache={modelFromCache}
        isTraining={trainProgress != null && trainProgress < 100}
      />
    </div>
  );
}
