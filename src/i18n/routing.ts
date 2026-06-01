import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR", "en-US"],
  defaultLocale: "pt-BR",
  localePrefix: "always",
});

export type AppLocale = (typeof routing.locales)[number];
