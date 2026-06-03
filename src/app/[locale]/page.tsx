import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gamepad2 } from "lucide-react";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { HomeFlow } from "@/components/home-flow";

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

        <HomeFlow
          labels={{
            steamPlaceholder: t("home.steamPlaceholder"),
            cta: t("home.cta"),
            manualFallback: t("home.manualFallback"),
          }}
        />
      </main>
    </div>
  );
}

