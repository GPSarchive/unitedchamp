// The team's colour as the page's accent.
//
// A team's colour is never used as it is for text: navy or black would vanish
// on the dark page. `teamAccent` lifts it, by as little as needed, until it
// reads; a colour with no colour in it (black, white, grey) gives way to the
// site's orange, and shows only in the kit stripe.
//
// The same rule as src/app/lib/profile/colours.ts of the player area (branch
// feat/player-profile-area). When that lands, import liftOn / inkOn from there.

/** The page background the accent has to read on (bg of TeamPage). */
export const PAGE_BG = "#0a0a14";
/** The site's own orange: the accent of a team without a usable colour. */
export const HOUSE_ACCENT = "#fb923c";
const INK_DARK = "#0a0a0f";

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** "#rrggbb" in lower case, or null for anything that is not a hex colour. */
export function parseHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = HEX.exec(value.trim());
  if (!match) return null;
  const h = match[1].toLowerCase();
  return `#${h.length === 3 ? [...h].map((c) => c + c).join("") : h}`;
}

type Rgb = [number, number, number];

const rgbOf = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const hexOf = (rgb: Rgb) =>
  `#${rgb.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("")}`;

/** WCAG relative luminance, 0 (black) to 1 (white). */
export function luminance(hex: string): number {
  const [r, g, b] = rgbOf(hex).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio, 1 to 21. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function hslOf(hex: string): [h: number, s: number, l: number] {
  const [r, g, b] = rgbOf(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}

function hexOfHsl(h: number, s: number, l: number): string {
  if (s === 0) return hexOf([l * 255, l * 255, l * 255]);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const channel = (t: number) => {
    const x = (t + 1) % 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return hexOf([channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255]);
}

/**
 * `colour` made lighter, by as little as needed, until it reads on `bg` at
 * `min`:1. The hue and the saturation stay, so navy becomes a clear blue and
 * not a grey. A colour that already reads comes back unchanged.
 */
export function liftOn(bg: string, colour: string, min = 4.5): string {
  if (contrast(colour, bg) >= min) return colour;
  const [h, s, l] = hslOf(colour);
  let lo = l;
  let hi = 1;
  for (let i = 0; i < 16; i++) {
    const mid = (lo + hi) / 2;
    if (contrast(hexOfHsl(h, s, mid), bg) >= min) hi = mid;
    else lo = mid;
  }
  return hexOfHsl(h, s, hi);
}

/** Near-black or white, whichever reads better on `fill`. */
export const inkOn = (fill: string): string =>
  contrast(fill, INK_DARK) >= contrast(fill, "#ffffff") ? INK_DARK : "#ffffff";

/** How colourful a colour is, 0 (grey) to 1. */
const chroma = (hex: string) => {
  const [r, g, b] = rgbOf(hex);
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
};

export type TeamAccent = {
  /** The team's colour exactly as stored, for the kit stripe; null when it has none. */
  kit: string | null;
  /** Readable on the page: links, rules, the team's own row in a table. */
  accent: string;
  /** Text colour on a block filled with `accent`. */
  ink: string;
};

export function teamAccent(colour: string | null | undefined): TeamAccent {
  const kit = parseHex(colour);
  const accent = kit && chroma(kit) >= 0.12 ? liftOn(PAGE_BG, kit, 4.5) : HOUSE_ACCENT;
  return { kit, accent, ink: inkOn(accent) };
}
