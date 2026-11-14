// How a player's name is lettered in the list rows and on the open profile:
// «Λευκό χρώμιο», chosen out of five candidates. The other four (white with a
// glow, white neon outline, flame, embossed gold) and the picker that switched
// between them are in this file's git history.
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
  // No glow, no hard shadow, no dark horizon band: just white easing into
  // a cool silver, so it reads as metal without the 80s-chrome effect.
  style: {
    backgroundImage: "linear-gradient(180deg, #ffffff 0%, #f6f7f9 42%, #c9ced7 78%, #aab1bd 100%)",
    WebkitBackgroundClip: "text",
    backgroundClip: "text",
    color: "transparent",
  },
};
