// The flat layered look: how a panel is DRAWN, and nothing else. It replaces
// the old frame (2px border + hard offset shadow) and leaves everything inside
// a component where it was: same elements, same places, same lettering, same
// labels. These are treatments only: no sizes, no spacing, no typography.
//
//   ground   #0a0a14 (the page)
//   surface  #12121e (a panel: one flat fill, rounded, no border)
//   depth    comes from layers, not lines:
//              – behind a panel, two sheets of its accent colour show under its
//                bottom edge, like a stack of cards (`layers(accent)`). This is
//                where the old orange/blue offset slab went;
//              – inside a panel, a header or footer strip is a tone of the
//                surface (STRIP_TOP / STRIP_BOTTOM), not a bordered bar.
//   line     ivory at 8–10%, 1px, only between rows and grid cells
//   signal   #fb923c orange: kept wherever the old design had it, as a fill or
//            a tint instead of an outline
//
// No imports, so both server and client files can take these.

/** A panel's fill and shape. Replaces `border-2 border-… bg-[#0a0a14]`. */
export const SURFACE = "rounded-xl bg-[#12121e]";

/**
 * The sheets under a panel, as a `box-shadow` value: put it in `style` on the
 * element that carries SURFACE (or on a wrapper with the same `rounded-xl`).
 * Replaces the hard offset slab (`10px 10px 0 0 accent`).
 */
export const layers = (accent: string) => {
  const c = visible(accent);
  return `0 6px 0 -3px ${c}, 0 12px 0 -8px color-mix(in srgb, ${c} 40%, transparent)`;
};

/** One sheet only, for small panels that sit in a grid. */
export const layer = (accent: string) => `0 5px 0 -3px ${visible(accent)}`;

/**
 * A sheet has to show on the dark ground. Team colours can be near-black or
 * deep navy; those are lifted towards ivory until they read (the hue stays).
 * Anything that is not a plain hex colour passes through untouched.
 */
function visible(accent: string): string {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(accent.trim())?.[1];
  if (!hex) return accent;
  const full = hex.length === 3 ? hex.replace(/./g, "$&$&") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  // Perceived brightness, 0–255.
  const light = 0.299 * r + 0.587 * g + 0.114 * b;
  const MIN = 95;
  if (light >= MIN) return accent;
  // Mix with ivory (#F3EFE6) just enough to reach MIN.
  const ivory = [243, 239, 230];
  const ivoryLight = 0.299 * ivory[0] + 0.587 * ivory[1] + 0.114 * ivory[2];
  const t = (MIN - light) / (ivoryLight - light);
  const mix = [r, g, b].map((v, i) => Math.round(v + (ivory[i] - v) * t));
  return `#${mix.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

/** A header strip inside a panel: lifted one tone. Replaces `border-b-2 … bg-[#13131d]`. */
export const STRIP_TOP = "bg-[#F3EFE6]/[0.05]";

/** A footer strip inside a panel: sunk one tone. Replaces `border-t-2 … bg-[#0d0d18]`. */
export const STRIP_BOTTOM = "bg-black/25";

/** The one line that stays: between rows, between calendar cells. Use with border-t / border-r / border-b. */
export const LINE = "border-[#F3EFE6]/[0.08]";

/** A small neutral box (a tag, a neutral button). Replaces `border border-[#F3EFE6]/20 bg-…`. */
export const CHIP = "rounded-md bg-[#F3EFE6]/[0.08]";
export const CHIP_HOVER = "hover:bg-[#F3EFE6]/[0.14]";

/** A small orange box (the date of the next match, «Σήμερα»). Replaces `border-2 border-[#fb923c]`. */
export const CHIP_ORANGE = "rounded-md bg-[#fb923c]/[0.16]";

/** The same for a button's shape. */
export const BUTTON_SHAPE = "rounded-lg bg-[#F3EFE6]/[0.08] hover:bg-[#F3EFE6]/[0.14]";
export const BUTTON_SHAPE_ORANGE = "rounded-lg bg-[#fb923c]/[0.16] hover:bg-[#fb923c] hover:text-[#08080f]";
