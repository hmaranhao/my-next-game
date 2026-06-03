import { getTranslations, setRequestLocale } from "next-intl/server";
import { Gamepad2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { ManualProfileForm } from "@/components/manual-profile-form";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function ManualPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("manual");

  return (
    <div className="relative flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <Gamepad2 className="size-7 text-[var(--gamer-accent)]" />
          <span className="font-semibold">{t("title")}</span>
        </Link>
        <LocaleSwitcher />
      </header>
      <main className="flex-1 px-4 pb-12">
        <p className="text-center text-muted-foreground">{t("subtitle")}</p>
        <ManualProfileForm />
      </main>
    </div>
  );
}
