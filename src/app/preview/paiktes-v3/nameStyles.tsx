// How a player's name is lettered in the list rows and on the open profile.
// Several candidates exist while this is a preview; a picker above the list
// switches between them and remembers the choice. Once one is chosen, keep
// that entry (and its font, with `preload` back on) and delete the rest.
"use client";

import { useEffect, useState } from "react";
import {
  Dela_Gothic_One,
  Fira_Sans_Extra_Condensed,
  Sofia_Sans_Extra_Condensed,
  Tektur,
} from "next/font/google";

// All four carry Greek. Not preloaded: only one of them is on screen at a time.
const fira = Fira_Sans_Extra_Condensed({
  subsets: ["latin", "greek"],
  weight: "900",
  style: "italic",
  display: "swap",
  preload: false,
});
const sofia = Sofia_Sans_Extra_Condensed({
  subsets: ["latin", "greek"],
  weight: "900",
  style: "italic",
  display: "swap",
  preload: false,
});
const dela = Dela_Gothic_One({ subsets: ["latin", "greek"], weight: "400", display: "swap", preload: false });
const tektur = Tektur({ subsets: ["latin", "greek"], weight: "800", display: "swap", preload: false });

export type NameStyleId = "white" | "chrome" | "outline" | "fire" | "gold";

type Lettering = {
  id: NameStyleId;
  label: string;
  hint: string;
  /** Typeface + size in a list row. */
  row: string;
  /** Typeface + size for the big name on the open profile. */
  title: string;
  /** Colour, gradient and glow. Glows are `filter`s, which a truncated line does not clip. */
  style: React.CSSProperties;
};

const clip = (backgroundImage: string): React.CSSProperties => ({
  backgroundImage,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
});

export const NAME_STYLES: Lettering[] = [
  {
    id: "white",
    label: "Λευκό με λάμψη",
    hint: "Καθαρό λευκό, βαριά πλάγια γράμματα, με ζεστή λάμψη γύρω τους.",
    row: `${fira.className} text-[1.5rem] sm:text-[1.8rem] md:text-[2.15rem] tracking-wide`,
    title: `${fira.className} text-5xl md:text-6xl tracking-wide`,
    style: {
      color: "#ffffff",
      filter:
        "drop-shadow(0 2px 0 rgba(0,0,0,0.75)) drop-shadow(0 0 7px rgba(255,255,255,0.5)) drop-shadow(0 0 16px rgba(251,146,60,0.45))",
    },
  },
  {
    id: "chrome",
    label: "Λευκό χρώμιο",
    hint: "Λευκό που σβήνει απαλά σε ασημί προς τα κάτω — μεταλλικό, χωρίς λάμψη.",
    row: `${sofia.className} text-[1.65rem] sm:text-[2rem] md:text-[2.4rem] tracking-[0.015em]`,
    title: `${sofia.className} text-6xl md:text-7xl tracking-[0.015em]`,
    // No glow, no hard shadow, no dark horizon band: just white easing into
    // a cool silver, so it reads as metal without the 80s-chrome effect.
    style: clip("linear-gradient(180deg, #ffffff 0%, #f6f7f9 42%, #c9ced7 78%, #aab1bd 100%)"),
  },
  {
    id: "outline",
    label: "Λευκό νέον",
    hint: "Κούφια γράμματα με λευκό περίγραμμα και πορτοκαλί φως νέον· γεμίζουν όταν περνάει το ποντίκι.",
    row: `${tektur.className} text-[1.05rem] sm:text-[1.35rem] md:text-[1.6rem] uppercase tracking-wide text-transparent transition-colors duration-200 group-hover:text-white`,
    title: `${tektur.className} text-4xl md:text-5xl tracking-wide text-transparent`,
    style: {
      WebkitTextStroke: "1.3px #ffffff",
      filter: "drop-shadow(0 0 5px rgba(251,146,60,0.9)) drop-shadow(0 0 14px rgba(251,146,60,0.5))",
    },
  },
  {
    id: "fire",
    label: "Φλόγα",
    hint: "Χοντρά γράμματα από κίτρινο σε βαθύ πορτοκαλί, σαν να καίνε.",
    row: `${dela.className} text-[0.92rem] sm:text-[1.15rem] md:text-[1.4rem]`,
    title: `${dela.className} text-3xl md:text-[2.6rem]`,
    style: {
      ...clip("linear-gradient(180deg, #FFF7C2 0%, #FFD23F 28%, #fb923c 60%, #dc4a0c 100%)"),
      filter: "drop-shadow(0 2px 0 rgba(60,15,0,0.9)) drop-shadow(0 0 9px rgba(251,146,60,0.6))",
    },
  },
  {
    id: "gold",
    label: "Χρυσό ανάγλυφο",
    hint: "Χρυσό με σκληρή ανταύγεια και σκιά, σαν χυτό μέταλλο — ταιριάζει με τις κάρτες.",
    row: `${fira.className} text-[1.5rem] sm:text-[1.8rem] md:text-[2.15rem] tracking-wide`,
    title: `${fira.className} text-5xl md:text-6xl tracking-wide`,
    style: {
      ...clip(
        "linear-gradient(180deg, #FFF8D6 0%, #FFE08A 30%, #D4A017 50%, #8F6A08 54%, #FFD866 72%, #B8860B 100%)",
      ),
      filter: "drop-shadow(0 2px 0 #2f2000) drop-shadow(0 0 8px rgba(255,193,7,0.4))",
    },
  },
];

const BY_ID = new Map(NAME_STYLES.map((s) => [s.id, s] as const));
export const nameStyle = (id: NameStyleId): Lettering => BY_ID.get(id) ?? NAME_STYLES[0];

const STORAGE_KEY = "paiktes-v3:name-style";

/** The chosen lettering, remembered in this browser. */
export function useNameStyle(): [NameStyleId, (id: NameStyleId) => void] {
  const [id, setId] = useState<NameStyleId>("white");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && BY_ID.has(saved as NameStyleId)) setId(saved as NameStyleId);
    } catch {
      // Storage unavailable: the default is fine.
    }
  }, []);
  const choose = (next: NameStyleId) => {
    setId(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Not remembered, still applied.
    }
  };
  return [id, choose];
}

/** Preview only: compare the letterings. Remove once one is chosen. */
export function NameStylePicker({
  value,
  onChange,
}: {
  value: NameStyleId;
  onChange: (id: NameStyleId) => void;
}) {
  return (
    // `min-w-0`: a fieldset is as wide as its content by default, which would
    // push the page wider than a phone instead of letting the options scroll.
    <fieldset className="min-w-0 px-4 pb-3 md:px-6">
      <legend className="text-[13px] text-[#F3EFE6]/65">Γράμματα ονομάτων (προεπισκόπηση)</legend>
      <div className="mt-1.5 flex gap-px overflow-x-auto border border-[#F3EFE6]/20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAME_STYLES.map((option) => {
          const active = option.id === value;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onChange(option.id)}
              aria-pressed={active}
              title={option.hint}
              className={`h-10 shrink-0 grow whitespace-nowrap px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#fb923c] ${
                active ? "bg-[#fb923c] font-bold text-[#0a0a14]" : "text-[#F3EFE6]/80 hover:bg-[#F3EFE6]/[0.06]"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[13px] text-[#F3EFE6]/60">{nameStyle(value).hint}</p>
    </fieldset>
  );
}
