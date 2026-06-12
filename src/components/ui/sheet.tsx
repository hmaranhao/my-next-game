"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

let scrollLockCount = 0;
let previousBodyOverflow = "";

function lockBodyScroll() {
  scrollLockCount += 1;
  if (scrollLockCount === 1) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
}

function unlockBodyScroll() {
  scrollLockCount = Math.max(0, scrollLockCount - 1);
  if (scrollLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

type SheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "right" | "left";
  /** Optional test id for the dialog root */
  "data-testid"?: string;
};

export function Sheet({
  open,
  onOpenChange,
  children,
  side = "right",
  "data-testid": dataTestId,
}: SheetProps) {
  React.useEffect(() => {
    if (!open) return;

    lockBodyScroll();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      unlockBodyScroll();
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex overscroll-none"
      role="dialog"
      aria-modal="true"
      data-testid={dataTestId}
    >
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 touch-none bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        className={cn(
          "relative z-10 flex h-full w-full max-w-lg flex-col overscroll-contain border-border bg-background shadow-xl",
          side === "right" ? "ml-auto border-l" : "mr-auto border-r",
        )}
        onClick={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function SheetClose({
  className,
  label,
  onClick,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid="training-drawer-close"
      className={cn(
        "absolute right-3 top-3 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        className,
      )}
      onClick={onClick}
      {...props}
    >
      <X className="size-5" aria-hidden />
    </button>
  );
}

export function SheetHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 flex-col gap-1.5 border-b border-border p-4 pr-12",
        className,
      )}
      {...props}
    />
  );
}

export function SheetTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold", className)} {...props} />
  );
}

export function SheetContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain p-4", className)}
      {...props}
    />
  );
}
