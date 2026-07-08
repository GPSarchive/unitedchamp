"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Bottom sheet on mobile, centered panel on lg+.
 * Portal + backdrop + body scroll lock + Escape/backdrop close + focus trap.
 */
export default function Sheet({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  /** wider desktop panel for dense editors */
  wide?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Body scroll lock
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Escape close + rudimentary focus trap
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          "relative w-full rounded-t-2xl border border-white/10 bg-[#0d0f14] shadow-2xl",
          "max-h-[90dvh] overflow-y-auto overscroll-contain",
          "lg:rounded-2xl lg:max-h-[85dvh]",
          wide ? "lg:max-w-4xl" : "lg:max-w-2xl",
        ].join(" ")}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/8 bg-[#0d0f14]/95 px-4 py-3 backdrop-blur">
          <div className="mx-auto absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-zinc-700 lg:hidden" aria-hidden />
          <h2 className="text-sm font-bold text-white truncate pt-1 lg:pt-0">{title ?? ""}</h2>
          <button
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}
