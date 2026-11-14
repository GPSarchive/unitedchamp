// The card's background — the surface behind the team logo when a player has
// no photo (a photo covers it). Several candidates exist while this is a
// preview; a picker under the profile's card switches between them for the
// big card and the small cards in the list alike, and remembers the choice.
// Once one is chosen, keep it as the cards' surface and delete the rest.
"use client";

import { useEffect, useState } from "react";

export type CardBackgroundId =
  | "weave"
  | "black"
  | "onyx"
  | "ink"
  | "warm"
  | "graphite"
  | "charcoal"
  | "carbon"
  | "glow";

type CardBackground = {
  id: CardBackgroundId;
  label: string;
  hint: string;
  /** CSS `background` of the profile's big card. */
  big: string;
  /** The same for a list row's small card (patterns drawn finer). */
  mini: string;
};

/** Carbon fibre: a twill of two near-blacks, drawn at `cell` px per repeat. */
const carbon = (cell: number) => {
  const h = cell / 2;
  const q = cell / 4;
  const s = `${cell}px ${cell}px`;
  return (
    `linear-gradient(27deg, #151517 ${q}px, transparent ${q}px) 0 ${q}px / ${s}, ` +
    `linear-gradient(207deg, #151517 ${q}px, transparent ${q}px) ${h}px 0 / ${s}, ` +
    `linear-gradient(27deg, #222225 ${q}px, transparent ${q}px) 0 ${h}px / ${s}, ` +
    `linear-gradient(207deg, #222225 ${q}px, transparent ${q}px) ${h}px ${q}px / ${s}, ` +
    `linear-gradient(90deg, #1b1b1e ${h}px, transparent ${h}px) 0 0 / ${s}, ` +
    `linear-gradient(#1d1d20 25%, #19191c 25%, #19191c 50%, transparent 50%, transparent 75%, #242427 75%, #242427) 0 0 / ${s}, ` +
    "#131315"
  );
};

export const CARD_BACKGROUNDS: CardBackground[] = [
  {
    id: "weave",
    label: "Τωρινό",
    hint: "Σκούρα ύφανση με χρυσή ανταύγεια πάνω αριστερά, όπως ήταν μέχρι τώρα.",
    big:
      "repeating-linear-gradient(90deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 8px), " +
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0 2px, transparent 2px 8px), " +
      "radial-gradient(circle at 30% 20%, rgba(212,175,55,0.16) 0%, transparent 60%), #0b0b0d",
    mini: "radial-gradient(circle at 30% 20%, rgba(212,175,55,0.22) 0%, transparent 65%), #0b0b0d",
  },
  { id: "black", label: "Μαύρο", hint: "Απόλυτο μαύρο, χωρίς τίποτα άλλο.", big: "#000000", mini: "#000000" },
  { id: "onyx", label: "Όνυχας", hint: "Μαύρο μια ιδέα πιο ανοιχτό από το απόλυτο.", big: "#0b0b0d", mini: "#0b0b0d" },
  {
    id: "ink",
    label: "Μπλε μαύρο",
    hint: "Μαύρο με μια σταγόνα μπλε — το ίδιο με το φόντο της σελίδας.",
    big: "#0a0a14",
    mini: "#0a0a14",
  },
  { id: "warm", label: "Ζεστό μαύρο", hint: "Μαύρο με μια σταγόνα καφέ, που δένει με το χρυσό.", big: "#15110b", mini: "#15110b" },
  { id: "graphite", label: "Γραφίτης", hint: "Βαθύ γκρίζο-μαύρο.", big: "#1b1b1e", mini: "#1b1b1e" },
  { id: "charcoal", label: "Ανθρακί", hint: "Το πιο ανοιχτό μαύρο της λίστας.", big: "#2a2a2e", mini: "#2a2a2e" },
  {
    id: "carbon",
    label: "Ανθρακονήματα",
    hint: "Μαύρη πλέξη από ανθρακονήματα, σαν αγωνιστικό υλικό.",
    big: carbon(20),
    mini: carbon(8),
  },
  {
    id: "glow",
    label: "Μαύρο με λάμψη",
    hint: "Σχεδόν μαύρο, με απαλό χρυσό φως που πέφτει από πάνω.",
    big: "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(212,175,55,0.3) 0%, rgba(212,175,55,0.07) 50%, transparent 78%), #050505",
    mini: "radial-gradient(ellipse 90% 60% at 50% 0%, rgba(212,175,55,0.34) 0%, rgba(212,175,55,0.08) 50%, transparent 78%), #050505",
  },
];

const BY_ID = new Map(CARD_BACKGROUNDS.map((b) => [b.id, b] as const));
export const cardBackground = (id: CardBackgroundId): CardBackground => BY_ID.get(id) ?? CARD_BACKGROUNDS[0];

const STORAGE_KEY = "paiktes-v3:card-bg";

/** The chosen background, remembered in this browser. */
export function useCardBackground(): [CardBackgroundId, (id: CardBackgroundId) => void] {
  const [id, setId] = useState<CardBackgroundId>("weave");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BY_ID.has(saved as CardBackgroundId)) setId(saved as CardBackgroundId);
    } catch {
      // Storage unavailable: the default is fine.
    }
  }, []);
  const choose = (next: CardBackgroundId) => {
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, still applied.
    }
  };
  return [id, choose];
}

/** Preview only: compare the backgrounds. Remove once one is chosen. */
export function CardBackgroundPicker({
  value,
  onChange,
}: {
  value: CardBackgroundId;
  onChange: (id: CardBackgroundId) => void;
}) {
  return (
    // `min-w-0`: a fieldset is as wide as its content by default, which would
    // push the page wider than a phone instead of letting the options scroll.
    <fieldset className="min-w-0">
      <legend className="text-[13px] text-[#F3EFE6]/65">Φόντο κάρτας (προεπισκόπηση)</legend>
      <div className="mt-1.5 flex gap-px overflow-x-auto border border-[#F3EFE6]/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CARD_BACKGROUNDS.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              title={option.hint}
              className={`flex h-11 shrink-0 items-center gap-2 whitespace-nowrap px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#fb923c] ${
                active ? "bg-[#fb923c] font-bold text-[#0a0a14]" : "text-[#F3EFE6]/80 hover:bg-[#F3EFE6]/[0.06]"
              }`}
            >
              {/* A swatch of the background itself, in a hairline gold frame. */}
              <span
                aria-hidden
                className="h-5 w-4 shrink-0 border border-[#D4AF37]/60"
                style={{ background: option.mini }}
              />
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[13px] text-[#F3EFE6]/60">{cardBackground(value).hint}</p>
    </fieldset>
  );
}
