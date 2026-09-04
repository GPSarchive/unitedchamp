"use client";

// Mobile-first bottom sheet (same pattern as dashboard/preview/teams-v2):
// dimmed backdrop, slide-up panel with a drag handle, Escape / backdrop to
// close, body scroll locked while open. Grows to a centred card on wide
// screens via max-w.

import { useEffect, useState } from "react";

export default function BottomSheet({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute inset-x-0 bottom-0 mx-auto flex max-h-[92vh] flex-col rounded-t-2xl border-x border-t border-white/10 bg-zinc-950 shadow-2xl transition-transform duration-200 ease-out ${
          wide ? "max-w-2xl" : "max-w-md"
        } ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pb-1 pt-2">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>
        <div className="border-b border-white/10 px-4 pb-3 pt-2">
          <div className="truncate text-sm font-semibold text-white">{title}</div>
          {subtitle ? <div className="mt-0.5 truncate text-xs text-white/55">{subtitle}</div> : null}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
