// How a player's name is lettered in the list rows and on the open profile:
// plain white (2026-11-15, owner: «turn it all to plain white»). It was
// «Λευκό χρώμιο», a white-to-silver gradient, chosen out of five candidates;
// that gradient, the other four (white with a glow, white neon outline,
// flame, embossed gold) and the picker that switched between them are in this
// file's git history. Every page that letters names this way (players list,
// profile, match, team, tournament) reads it from here.
import { Sofia_Sans_Extra_Condensed } from "next/font/google";

// Carries Greek. Preloaded: it is on screen as soon as the list is.
const sofia = Sofia_Sans_Extra_Condensed({
  subsets: ["latin", "greek"],
  weight: "900",
  style: "italic",
  display: "swap",
});

export type Lettering = {
  /** Typeface + size in a list row. */
  row: string;
  /** Typeface + size for the big name on the open profile. */
  title: string;
  /** Colour and gradient. */
  style: React.CSSProperties;
};

export const NAME_LETTERING: Lettering = {
  row: `${sofia.className} text-[1.65rem] sm:text-[2rem] md:text-[2.4rem] tracking-[0.015em]`,
  title: `${sofia.className} text-6xl md:text-7xl tracking-[0.015em]`,
  // Plain white: no gradient, no glow, no shadow.
  style: {
    color: "#FFFFFF",
  },
};
