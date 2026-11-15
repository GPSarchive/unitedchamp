// Manual framing of a player's photo inside a card: three numbers per card.
//   x, y  — which point of the photo is kept in view, in percent of the
//           photo's hidden overflow (50, 0 = centred, aligned to the top:
//           what every card does today);
//   zoom  — 1 (as today) up to MAX_ZOOM.
// The photo always covers its box, so no setting can leave a gap.
//
// The cards themselves are not changed. Every card (normal, «Θρύλος» 1 and 2,
// big and mini) draws its photo as `<img class="… object-cover object-top">`
// and nothing else carries `object-top`, so one CSS rule under a
// `.card-framing` wrapper reaches the photo in all of them.
//
// TRIAL: the numbers live in this browser only (localStorage). The real
// version keeps the same three numbers next to the record that gives a player
// the special card.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type Framing = { x: number; y: number; zoom: number };

export const DEFAULT_FRAMING: Framing = { x: 50, y: 0, zoom: 1 };
export const MAX_ZOOM = 3;

const PHOTO = ".card-framing img.object-top";
const CSS =
  `${PHOTO}{object-position:var(--frame-x,50%) var(--frame-y,0%);` +
  `transform-origin:var(--frame-x,50%) var(--frame-y,0%);transform:scale(var(--frame-zoom,1))}`;

/** The one rule that applies a framing. React keeps a single copy in <head>. */
export function FramingStyles() {
  return (
    <style href="card-framing" precedence="medium">
      {CSS}
    </style>
  );
}

/** Wrap a card in this to frame its photo; `null` leaves the card as it is. */
export function Framed({ framing, children }: { framing: Framing | null; children: React.ReactNode }) {
  const style = framing
    ? ({ "--frame-x": `${framing.x}%`, "--frame-y": `${framing.y}%`, "--frame-zoom": framing.zoom } as React.CSSProperties)
    : undefined;
  return (
    <div className="card-framing" style={style}>
      {children}
    </div>
  );
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const round = (value: number, digits: number) => Number(value.toFixed(digits));

function isFraming(value: unknown): value is Framing {
  const f = value as Framing | null;
  return !!f && [f.x, f.y, f.zoom].every((n) => typeof n === "number" && Number.isFinite(n));
}

const STORAGE_KEY = "uc-card-framing-v1";

/** Framings by key (`<player id>:<card style>`), kept in this browser. */
export function useFramings() {
  const [map, setMap] = useState<Record<string, Framing>>({});
  const current = useRef(map);

  // Read after mount, so the first paint matches what the server sent.
  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
      if (!stored || typeof stored !== "object") return;
      const valid = Object.fromEntries(Object.entries(stored).filter(([, value]) => isFraming(value)));
      current.current = valid as Record<string, Framing>;
      setMap(current.current);
    } catch {
      // Private window or blocked storage: the editor still works, unsaved.
    }
  }, []);

  const set = useCallback((key: string, framing: Framing | null) => {
    const next = { ...current.current };
    if (framing) next[key] = framing;
    else delete next[key];
    current.current = next;
    setMap(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // See above.
    }
  }, []);

  return [map, set] as const;
}

/**
 * Lies over a card and turns a drag into a new framing: the photo follows the
 * pointer. It must be a sibling of the framed card (it looks for the photo in
 * its parent). While it is there the card under it gets no pointer events, so
 * the card's own tilt stays still.
 */
export function PhotoDragLayer({ framing, onChange }: { framing: Framing; onChange: (next: Framing) => void }) {
  const layer = useRef<HTMLDivElement>(null);
  const drag = useRef<{ px: number; py: number; from: Framing; perX: number; perY: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function start(event: React.PointerEvent<HTMLDivElement>) {
    const photo = layer.current?.parentElement?.querySelector<HTMLImageElement>(PHOTO);
    if (!photo || !photo.naturalWidth) return;
    // On-screen size of the photo's box (its own zoom taken back out).
    const rect = photo.getBoundingClientRect();
    const boxW = rect.width / framing.zoom;
    const boxH = rect.height / framing.zoom;
    const cover = Math.max(boxW / photo.naturalWidth, boxH / photo.naturalHeight);
    drag.current = {
      px: event.clientX,
      py: event.clientY,
      from: framing,
      // Screen pixels the photo moves for one percent of x / y.
      perX: (framing.zoom * photo.naturalWidth * cover - boxW) / 100,
      perY: (framing.zoom * photo.naturalHeight * cover - boxH) / 100,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    // No hidden overflow on an axis = nothing to move along it (zoom in first).
    const dx = d.perX > 0.01 ? (event.clientX - d.px) / d.perX : 0;
    const dy = d.perY > 0.01 ? (event.clientY - d.py) / d.perY : 0;
    onChange({ ...d.from, x: round(clamp(d.from.x - dx, 0, 100), 1), y: round(clamp(d.from.y - dy, 0, 100), 1) });
  }

  function end() {
    drag.current = null;
    setDragging(false);
  }

  return (
    <div
      ref={layer}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={`absolute inset-0 z-10 touch-none select-none rounded-lg outline-dashed outline-2 outline-offset-[6px] outline-[#D4AF37]/80 ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      {/* Four-way arrows: this photo can be dragged. */}
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="absolute right-1 top-1 h-6 w-6 rounded-full bg-black/60 p-1 text-[#FFE08A]"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3" />
      </svg>
    </div>
  );
}

/** Zoom slider plus reset / done, shown under the card being framed. */
export function FramingControls({
  framing,
  changed,
  onChange,
  onReset,
  onDone,
}: {
  framing: Framing;
  /** Whether this card has a saved framing (so reset has something to undo). */
  changed: boolean;
  onChange: (next: Framing) => void;
  onReset: () => void;
  onDone: () => void;
}) {
  const button = "rounded-full border px-3 py-1 text-[13px] transition-colors";
  return (
    <div className="mt-3 space-y-2">
      <label className="flex items-center gap-2 text-[13px] text-[#F3EFE6]/65">
        Μεγέθυνση
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={framing.zoom}
          onChange={(event) => onChange({ ...framing, zoom: round(Number(event.target.value), 2) })}
          className="min-w-0 flex-1 accent-[#D4AF37]"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={!changed}
          className={`${button} border-white/15 text-[#F3EFE6]/80 hover:border-white/40 disabled:opacity-40`}
        >
          Επαναφορά
        </button>
        <button
          type="button"
          onClick={onDone}
          className={`${button} border-[#D4AF37] bg-[#D4AF37] font-semibold text-[#0a0a14]`}
        >
          Τέλος
        </button>
      </div>
    </div>
  );
}
