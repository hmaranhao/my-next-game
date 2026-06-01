import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gamepad2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "@/components/locale-switcher";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations();

  return (
    <div className="relative flex min-h-full flex-1 flex-col overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--gamer-glow)_0%,_transparent_55%)] opacity-40"
        aria-hidden
      />
      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Gamepad2 className="size-7 text-[var(--gamer-accent)]" />
          <span className="font-semibold tracking-tight">{t("app.title")}</span>
        </div>
        <LocaleSwitcher />
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 pb-12 pt-4 text-center sm:px-6">
        <p className="mb-2 text-xs font-medium uppercase tracking-[0.2em] text-[var(--gamer-accent)]">
          Steam · AI
        </p>
        <h1 className="max-w-lg text-3xl font-bold tracking-tight sm:text-4xl">
          {t("app.title")}
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">{t("app.tagline")}</p>

        <div className="mt-10 w-full max-w-sm space-y-4">
          <input
            type="text"
            placeholder={t("home.steamPlaceholder")}
            className="h-11 w-full rounded-lg border border-border bg-card/80 px-4 text-sm outline-none ring-[var(--gamer-accent)] placeholder:text-muted-foreground focus:ring-2"
            disabled
            aria-label={t("home.steamPlaceholder")}
          />
          <Button size="lg" className="w-full gamer-cta" disabled>
            {t("home.cta")}
          </Button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-[var(--gamer-accent)] hover:underline"
            disabled
          >
            {t("home.manualFallback")}
          </button>
        </div>
      </main>
    </div>
  );
}

