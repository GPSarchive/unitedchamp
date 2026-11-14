// Pieces shared by the two player cards (flat metal and holographic).
import { statValue, type StatKey, type StatTuple } from "../model";

// Flat top with a slight peak and cut shoulders, pointed bottom.
export const SHIELD =
  "polygon(50% 0%, 88% 3.2%, 100% 7.5%, 100% 79%, 50% 100%, 0% 79%, 0% 7.5%, 12% 3.2%)";

/** Two rows of three, in reading order. */
export const CARD_STATS: { key: StatKey; label: string; title: string }[] = [
  { key: "goals", label: "ΓΚΟΛ", title: "Γκολ" },
  { key: "assists", label: "ΑΣΙ", title: "Ασίστ" },
  { key: "matches", label: "ΑΓΩ", title: "Αγώνες" },
  { key: "wins", label: "ΝΙΚ", title: "Νίκες" },
  { key: "mvp", label: "MVP", title: "Βραβεία MVP" },
  { key: "best_gk", label: "ΤΕΡ", title: "Βραβεία καλύτερου τερματοφύλακα" },
];

export function CardStatGrid({
  stats,
  soft,
  className = "",
}: {
  stats: StatTuple;
  /** Colour of the small labels. */
  soft: string;
  className?: string;
}) {
  return (
    <dl className={`grid grid-cols-3 gap-x-1 gap-y-2 ${className}`}>
      {CARD_STATS.map(({ key, label, title }) => (
        <div key={key} className="flex items-baseline justify-center gap-1" title={title}>
          <dd className="text-xl font-bold leading-none tabular-nums">{statValue(stats, key)}</dd>
          <dt className="text-[0.7rem] leading-none" style={{ color: soft }}>
            <abbr title={title} className="no-underline">
              {label}
            </abbr>
          </dt>
        </div>
      ))}
    </dl>
  );
}

/**
 * The card's shadow as its own blurred shape behind the card, instead of a
 * `filter: drop-shadow` on the card. A filter on the card would be recomputed
 * every time anything on the card moves; this is painted once and only ever
 * moved with the card.
 */
export function CardShadow({ glow }: { glow?: string }) {
  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ filter: "blur(16px)", opacity: 0.6, transform: "translateY(5%) scale(0.94)" }}
      >
        <div className="h-full w-full" style={{ clipPath: SHIELD, background: "#000" }} />
      </div>
      {glow && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{ filter: "blur(20px)", opacity: 0.35, transform: "scale(1.02)" }}
        >
          <div className="h-full w-full" style={{ clipPath: SHIELD, background: glow }} />
        </div>
      )}
    </>
  );
}

/** Person outline for players without a photo. */
export function Silhouette({ color, opacity = 0.28 }: { color: string; opacity?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 100 100" className="h-full w-full" style={{ color, opacity }}>
      <circle cx="50" cy="32" r="19" fill="currentColor" />
      <path d="M12 100c0-24 17-38 38-38s38 14 38 38z" fill="currentColor" />
    </svg>
  );
}
