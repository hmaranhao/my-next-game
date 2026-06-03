"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LGPD_POLICY_VERSION } from "@/lib/lgpd/constants";
import type { NormalizedUserProfile, ProfileApiError } from "@/types/profile";

export function ManualProfileForm() {
  const t = useTranslations("manual");
  const tErr = useTranslations("errors");
  const locale = useLocale();

  const [displayName, setDisplayName] = useState("");
  const [favoriteGenres, setFavoriteGenres] = useState("");
  const [favoriteGames, setFavoriteGames] = useState("");
  const [playedGames, setPlayedGames] = useState("");
  const [playtime, setPlaytime] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [country, setCountry] = useState("");
  const [consentOpen, setConsentOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<NormalizedUserProfile | null>(null);

  function splitLines(text: string) {
    return text
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function splitCsv(text: string) {
    return text
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  async function submitWithConsent() {
    setConsentOpen(false);
    setLoading(true);
    setError(null);

    try {
      const consentRes = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepted: true, locale }),
      });
      const consentJson = await consentRes.json();
      if (!consentJson.consentId) {
        setError(tErr("consentRequired"));
        return;
      }

      const res = await fetch("/api/profile/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consentId: consentJson.consentId,
          displayName,
          favoriteGenres: splitCsv(favoriteGenres),
          favoriteGames: splitLines(favoriteGames),
          playedGames: splitLines(playedGames),
          approximatePlaytimeHours: playtime ? Number(playtime) : undefined,
          ageRange: ageRange || undefined,
          countryCode: country || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError((json as ProfileApiError).message || tErr("generic"));
        return;
      }
      setProfile(json.profile);
    } catch {
      setError(tErr("generic"));
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-lg border border-border bg-card/80 px-4 text-sm outline-none focus:ring-2 focus:ring-[var(--gamer-accent)]";

  if (profile) {
    return (
      <div className="mx-auto mt-8 w-full max-w-md rounded-xl border border-border bg-card/80 p-6">
        <p className="font-semibold">{profile.displayName}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {profile.inferredGenres.join(" · ")}
        </p>
        <Link href="/" className="mt-4 inline-block text-sm text-[var(--gamer-accent)]">
          ← {t("back")}
        </Link>
      </div>
    );
  }

  return (
    <form
      className="mx-auto mt-8 w-full max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setConsentOpen(true);
      }}
    >
      <label className="block space-y-1 text-sm">
        <span>{t("displayName")}</span>
        <input
          className={inputClass}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("favoriteGenres")}</span>
        <input
          className={inputClass}
          value={favoriteGenres}
          onChange={(e) => setFavoriteGenres(e.target.value)}
          placeholder="RPG, Action, Indie"
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("favoriteGames")}</span>
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          value={favoriteGames}
          onChange={(e) => setFavoriteGames(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("playedGames")}</span>
        <textarea
          className={`${inputClass} min-h-24 py-2`}
          value={playedGames}
          onChange={(e) => setPlayedGames(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("playtime")}</span>
        <input
          type="number"
          min={0}
          className={inputClass}
          value={playtime}
          onChange={(e) => setPlaytime(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("ageRange")}</span>
        <input
          className={inputClass}
          value={ageRange}
          onChange={(e) => setAgeRange(e.target.value)}
        />
      </label>
      <label className="block space-y-1 text-sm">
        <span>{t("country")}</span>
        <input
          className={inputClass}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </label>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" className="gamer-cta flex-1" disabled={loading}>
          {loading ? "…" : t("submit")}
        </Button>
        <Link
          href="/"
          className="inline-flex h-9 items-center justify-center rounded-lg border border-border px-4 text-sm hover:bg-muted"
        >
          {t("back")}
        </Link>
      </div>

      {consentOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">
              LGPD v{LGPD_POLICY_VERSION} — consent for manual profile data.
            </p>
            <div className="mt-4 flex gap-2">
              <Button className="gamer-cta flex-1" onClick={submitWithConsent}>
                OK
              </Button>
              <Button variant="outline" onClick={() => setConsentOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
