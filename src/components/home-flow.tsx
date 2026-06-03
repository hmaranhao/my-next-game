"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import type { NormalizedUserProfile, ProfileApiError } from "@/types/profile";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd/constants";

type Props = {
  labels: {
    steamPlaceholder: string;
    cta: string;
    manualFallback: string;
  };
};

export function HomeFlow({ labels }: Props) {
  const t = useTranslations();
  const locale = useLocale();
  const [steamInput, setSteamInput] = useState("");
  const [showConsent, setShowConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NormalizedUserProfile | null>(null);

  async function requestConsentAndFetch() {
    if (!steamInput.trim()) return;
    setShowConsent(true);
  }

  async function onAcceptConsent() {
    setShowConsent(false);
    setLoading(true);
    setError(null);
    setProfile(null);

    try {
      const consentRes = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, locale }),
      });
      const consentJson = await consentRes.json();
      if (!consentJson.ok || !consentJson.consentId) {
        throw new Error(t("errors.consentRequired"));
      }

      const profileRes = await fetch("/api/profile/steam", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          steamInput,
          consentId: consentJson.consentId,
        }),
      });
      const profileJson = await profileRes.json();

      if (!profileJson.ok) {
        setError(mapError(t, profileJson as ProfileApiError));
        return;
      }

      setProfile(profileJson.profile);
    } catch {
      setError(t("errors.generic"));
    } finally {
      setLoading(false);
    }
  }

  if (profile) {
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
          {profile.topGames.length > 0 ? (
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              {profile.topGames.slice(0, 3).map((g) => (
                <li key={g.appId}>
                  {g.name} — {g.playtimeHours}h
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          {t("home.nextStep")}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="mt-10 w-full max-w-sm space-y-4">
        <input
          type="text"
          value={steamInput}
          onChange={(e) => setSteamInput(e.target.value)}
          placeholder={labels.steamPlaceholder}
          className="h-11 w-full rounded-lg border border-border bg-card/80 px-4 text-sm outline-none ring-[var(--gamer-accent)] placeholder:text-muted-foreground focus:ring-2"
          disabled={loading}
          aria-label={labels.steamPlaceholder}
        />
        <Button
          size="lg"
          className="w-full gamer-cta"
          disabled={loading || !steamInput.trim()}
          onClick={requestConsentAndFetch}
        >
          {loading ? t("home.loading") : labels.cta}
        </Button>
        <Link
          href="/manual"
          className="block text-sm text-muted-foreground underline-offset-4 hover:text-[var(--gamer-accent)] hover:underline"
        >
          {labels.manualFallback}
        </Link>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      {showConsent ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lgpd-title"
        >
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
            <h2 id="lgpd-title" className="text-lg font-semibold">
              {t("lgpd.title")}
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">{t("lgpd.body")}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              {t("lgpd.policyVersion", { version: LGPD_POLICY_VERSION })}
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Button className="flex-1 gamer-cta" onClick={onAcceptConsent}>
                {t("lgpd.accept")}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowConsent(false)}
              >
                {t("lgpd.decline")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function mapError(
  t: ReturnType<typeof useTranslations>,
  err: ProfileApiError,
): string {
  switch (err.code) {
    case "MISSING_STEAM_API_KEY":
      return t("errors.missingApiKey");
    case "PROFILE_PRIVATE":
      return t("errors.profilePrivate");
    case "STEAM_NOT_FOUND":
      return t("errors.notFound");
    default:
      return err.message || t("errors.generic");
  }
}
