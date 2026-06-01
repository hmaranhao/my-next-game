"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export function LocaleSwitcher() {
  const t = useTranslations("locale");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function onChange(nextLocale: AppLocale) {
    router.replace(pathname, { locale: nextLocale });
  }

  return (
    <label className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="sr-only">{t("label")}</span>
      <select
        value={locale}
        onChange={(e) => onChange(e.target.value as AppLocale)}
        className="rounded-md border border-border bg-card/80 px-2 py-1 text-foreground outline-none focus:ring-2 focus:ring-[var(--gamer-accent)]"
        aria-label={t("label")}
      >
        {routing.locales.map((loc) => (
          <option key={loc} value={loc}>
            {loc === "pt-BR" ? "PT" : "EN"}
          </option>
        ))}
      </select>
    </label>
  );
}
