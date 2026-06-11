"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Gamepad2 } from "lucide-react";

type Props = {
  src: string | null | undefined;
  className?: string;
  compact?: boolean;
};

export function GameCoverImage({ src, className, compact }: Props) {
  const t = useTranslations("game");
  const [failed, setFailed] = useState(false);
  const showPlaceholder = !src || failed;

  if (showPlaceholder) {
    return (
      <div
        className={`flex items-center justify-center bg-gradient-to-br from-[var(--gamer-glow)]/30 to-muted ${className ?? ""}`}
        role="img"
        aria-label={t("imageFallback")}
      >
        <Gamepad2
          className={compact ? "size-6 text-[var(--gamer-accent)]/70" : "size-10 text-[var(--gamer-accent)]/70"}
          aria-hidden
        />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
