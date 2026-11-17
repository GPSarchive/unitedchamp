// The «Ήρωας» (Hero) finish: its colours and the faceted violet surface of the
// card's upper zone. Shared by the big card and the mini card.
//
// Built the way the «Θρύλος» finish is (legend/v1/legendFinish.tsx): the
// facets are a small mesh that is turned into an SVG picture once, when this
// module loads, and given to the browser as a CSS background. A card adds no
// elements for them, and the picture's text is in the page once (one <style>,
// however many cards there are).
//
// What differs is what the reference differs in: purple instead of pale gold,
// fewer and larger facets, some of them four-sided, soft folds with barely a
// line of light on their edges. The purple is a deep royal one (a blue-leaning
// purple, never toward pink), so the card is dark with light text, like the
// black editions.

import { MOUNT, MOUNT_EDGE, MOUNT_MASK, mirrored } from "../../photoMount";

// ───────────────────────────────────────────────────────────────────────
// Colours
// ───────────────────────────────────────────────────────────────────────

/** The plate under the numbers, at its middle tone. Also the face's fill. */
export const VIOLET = "#4E1F96";
/** The edition's title, written in the foot of the card (in the name band on the mini card): this card's name on the dashboard. */
export const TITLE = "CHAMPIONS";
/**
 * The band the name sits in: a lighter royal purple, lightest at its centre,
 * a little deeper at its two ends. SNOW on its deepest end: 8.8:1; LILAC on
 * its lightest middle: 5.1:1.
 */
export const BAND = "linear-gradient(90deg, #5A27A6 0%, #6530B4 16%, #6B36BC 50%, #6530B4 84%, #5A27A6 100%)";
/** What the photo fades into above the name band. The values, for rgba(). */
export const DUSK_RGB = "69,24,138";
export const DUSK = "#45188A";
/** Last name and the six numbers. */
export const SNOW = "#FBF8FF";
/** First name, the small labels, the edition mark: a pale lilac. */
export const LILAC = "#E2D0FF";
/** Fill of the upper zone before the facets have painted. */
const AMETHYST = "#4B1D96";

/**
 * The plate: satin with slanted folds, lighter toward both sides, a darker
 * strip through the middle. Even the lightest fold keeps LILAC above 5:1.
 */
export const SATIN =
  "linear-gradient(68deg, #6230B0 0%, #5A29A7 11%, #5324A0 26%, #5828A5 27%, #4F2299 42.5%, " +
  "#461C8C 43.5%, #471D8D 58%, #5526A2 59%, #51229C 70%, #5628A4 84%, #5E2EAD 100%)";

/** Thin rim: a lighter violet than anything on the face, catching the light in two places. */
export const HERO_RIM =
  "conic-gradient(from 124deg at 50% 50%, #7444C8 0%, #8456DA 18%, #C3A3FF 30%, #7F50D4 46%, #6534B6 62%, #A985F5 78%, #8456DA 90%, #7444C8 100%)";
/** Flat version of the rim for the mini card. */
export const HERO_RIM_FLAT = "linear-gradient(150deg, #7444C8 0%, #C3A3FF 38%, #7F50D4 66%, #A985F5 100%)";

// ───────────────────────────────────────────────────────────────────────
// Facets
// ───────────────────────────────────────────────────────────────────────

type Mesh = {
  w: number;
  h: number;
  points: readonly (readonly [number, number])[];
  /** The facet's corners (point indices, three or four), then which way it leans (x, y; each -1…1). */
  facets: readonly (readonly [readonly number[], number, number])[];
};

// 45 facets for the big card: small ones in the corners and along the sides,
// larger ones — a third of them four-sided — across the middle.
const BIG: Mesh = {
  w: 100,
  h: 76,
  points: [
    [0, 0], [100, 0], [100, 76], [0, 76], [22, 0], [47, 0], [71, 0], [17, 76], [40, 76], [63, 76], [82, 76], [0, 16],
    [0, 34], [0, 55], [100, 18], [100, 37], [100, 54], [11, 15], [8, 42], [14, 65], [89, 10], [92, 30], [87, 63],
    [93, 47], [25, 13], [30, 27], [20, 38], [27, 55], [35, 68], [77, 14], [72, 29], [82, 44], [74, 60], [41, 9],
    [58, 17], [47, 31], [40, 47], [60, 43], [52, 59], [63, 69],
  ],
  facets: [
    [[20, 6, 1], 0.72, -0.06], [[4, 17, 0], -0.58, -0.65], [[5, 33, 24, 4], -0.79, 0.02], [[6, 34, 5], 0.38, 0.44],
    [[24, 17, 4], 0.15, 0.54], [[14, 20, 1], -0.7, -0.23], [[20, 6, 34, 29], -0.42, 0.54],
    [[17, 11, 0], -0.49, -0.37], [[35, 33, 5, 34], 0.69, 0.3], [[20, 21, 29], -0.09, 0.42],
    [[21, 20, 14], -0.67, -0.15], [[35, 25, 24, 33], -0.09, 0.73], [[11, 17, 12], -0.85, -0.2],
    [[29, 30, 35, 34], -0.47, 0.72], [[24, 17, 26, 25], -0.77, 0.42], [[21, 30, 29], 0.38, 0.22],
    [[21, 14, 15], -0.35, 0.33], [[17, 26, 12], -0.29, -0.25], [[26, 36, 35, 25], -0.24, 0.62],
    [[21, 30, 37, 31], -0.29, 0.46], [[36, 37, 30, 35], -0.47, 0.02], [[12, 26, 18], -0.37, 0.27],
    [[23, 21, 15], 0.22, -0.39], [[21, 23, 31], -0.19, -0.3], [[13, 12, 18], -0.18, 0.74],
    [[18, 26, 36, 27], -0.44, -0.03], [[16, 23, 15], -0.68, 0.51], [[36, 37, 38], -0.48, 0.38],
    [[23, 22, 31], -0.53, -0.21], [[22, 32, 37, 31], -0.17, -0.82], [[19, 13, 18], -0.18, 0.38],
    [[27, 19, 18], 0.59, -0.06], [[22, 23, 16], 0.69, -0.22], [[38, 28, 27, 36], -0.25, -0.54],
    [[39, 32, 37, 38], 0.58, 0.31], [[22, 16, 2], -0.8, 0.22], [[13, 19, 3], -0.43, -0.63],
    [[7, 19, 27, 28], 0.36, 0.17], [[39, 10, 22, 32], 0.19, -0.78], [[28, 38, 8], -0.41, 0.29],
    [[38, 39, 9, 8], -0.5, 0.71], [[10, 22, 2], 0.52, 0.43], [[19, 7, 3], 0.55, -0.68], [[7, 28, 8], -0.44, 0.01],
    [[39, 10, 9], 0.53, 0.4],
  ],
};

// 12 facets for the mini card: at 56px the big mesh would turn into noise.
const MINI: Mesh = {
  w: 100,
  h: 84,
  points: [
    [0, 0], [100, 0], [100, 84], [0, 84], [44, 0], [38, 84], [66, 84], [0, 46], [100, 36], [26, 52], [52, 22],
    [80, 14], [68, 56], [19, 15],
  ],
  facets: [
    [[11, 4, 1], 0.22, -0.45], [[4, 13, 0], -0.67, 0.33], [[4, 11, 10], -0.71, -0.48], [[4, 13, 9, 10], 0.05, 0.43],
    [[1, 8, 12, 11], 0.75, 0.21], [[0, 13, 9, 7], 0.77, 0.07], [[11, 12, 9, 10], 0.5, -0.25],
    [[12, 8, 2], -0.6, 0.51], [[7, 9, 3], 0.61, 0.14], [[12, 9, 3, 5], 0.47, 0.74], [[12, 6, 5], 0.37, 0.41],
    [[6, 12, 2], -0.78, -0.41],
  ],
};

// The frame every special card keeps around a photo (its left side), as a
// mesh of this file's kind.
const MOUNT_MESH: Mesh = {
  w: MOUNT.w,
  h: MOUNT.h,
  points: MOUNT.points,
  facets: MOUNT.facets.map(([a, b, c, leanX, leanY]) => [[a, b, c], leanX, leanY] as const),
};

// Dark → light. From the deepest royal purple of the surface to its lightest.
const TONES: readonly (readonly [number, number, number, number])[] = [
  [0, 0x24, 0x09, 0x55],
  [0.14, 0x2c, 0x0d, 0x64],
  [0.28, 0x35, 0x12, 0x74],
  [0.42, 0x40, 0x17, 0x85],
  [0.55, 0x4b, 0x1d, 0x96],
  [0.68, 0x57, 0x24, 0xa7],
  [0.8, 0x63, 0x2d, 0xb6],
  [0.9, 0x70, 0x39, 0xc3],
  [1, 0x7f, 0x48, 0xd0],
];

/** Hex colour (no "#") for a brightness 0…1. */
function tone(value: number): string {
  const v = Math.min(1, Math.max(0, value));
  let i = 1;
  while (i < TONES.length - 1 && v > TONES[i][0]) i += 1;
  const [t0, ...c0] = TONES[i - 1];
  const [t1, ...c1] = TONES[i];
  const k = (v - t0) / (t1 - t0);
  return c0
    .map((c, j) => Math.round(c + (c1[j] - c) * k).toString(16).padStart(2, "0"))
    .join("");
}

const bump = (x: number, y: number, cx: number, cy: number, spread: number) =>
  Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * spread * spread));

/**
 * How bright the surface is at a spot (0…1 across and down the zone) before
 * the facets' own lean counts: light all down the left side, falling off
 * steadily to deep purple at the right, with a little more light at the top
 * of the middle.
 */
function ambient(x: number, y: number): number {
  return 0.86 - 0.7 * x + 0.1 * bump(x, y, 0.45, 0.08, 0.25);
}

/**
 * The mesh as a CSS `url("data:…")` picture. `fromRight` paints the same
 * facets with the light on the other side — the big card fades between the
 * two as it is tilted. `mirror` paints the facets a second time, mirrored
 * onto the right: for the frame around a photo (`MOUNT_MESH`), of which only
 * the left side is written down.
 */
function facetPicture(mesh: Mesh, fromRight: boolean, edgeWidth: number, mirror = false): string {
  const lightX = fromRight ? 0.7 : -0.7;
  const lightY = -0.7;
  let gradients = "";
  const shapes: { value: number; path: string }[] = [];

  mesh.facets.forEach(([indices, leanX, leanY], i) => {
    const corners = indices.map((k) => mesh.points[k]);
    const cx = corners.reduce((sum, [x]) => sum + x, 0) / corners.length;
    const cy = corners.reduce((sum, [, y]) => sum + y, 0) / corners.length;
    const facing = leanX * lightX + leanY * lightY;
    const across = cx / mesh.w;
    const value = ambient(fromRight ? 1 - across : across, cy / mesh.h) + 0.32 * facing;

    // Each facet also shades across itself, lighter on the side nearer the
    // light — that is what makes it read as a folded sheet and not as flat
    // coloured paper.
    const length = Math.hypot(leanX, leanY) || 1;
    const sign = facing >= 0 ? 1 : -1;
    const ux = (leanX / length) * sign;
    const uy = (leanY / length) * sign;
    const along = corners.map(([x, y]) => (x - cx) * ux + (y - cy) * uy);
    const far = Math.min(...along);
    const near = Math.max(...along);

    gradients +=
      `<linearGradient id='f${i}' gradientUnits='userSpaceOnUse' ` +
      `x1='${n(cx + ux * far)}' y1='${n(cy + uy * far)}' x2='${n(cx + ux * near)}' y2='${n(cy + uy * near)}'>` +
      `<stop stop-color='#${tone(value - 0.13)}'/><stop offset='1' stop-color='#${tone(value + 0.13)}'/></linearGradient>`;
    // The edges catch a little light, around the lit facets only: these are
    // soft folds, not cut metal.
    const glint = Math.min(0.38, Math.max(0.05, 0.05 + (value - 0.55) * 0.9));
    shapes.push({
      value,
      path: `<path d='${outline(corners)}' fill='url(#f${i})' stroke-opacity='${n2(glint)}'/>`,
    });
  });

  // Darkest first, so the bright facets' lines end up on top.
  shapes.sort((p, q) => p.value - q.value);
  const paths = shapes.map((s) => s.path).join("");
  return picture(
    mesh,
    `<defs>${gradients}</defs>` +
      `<g stroke='#DCC8FF' stroke-width='${edgeWidth}' stroke-linejoin='round'>` +
      `${paths}${mirror ? mirrored(paths) : ""}</g>`,
  );
}

const n = (k: number) => String(Math.round(k * 10) / 10);
const n2 = (k: number) => String(Math.round(k * 100) / 100);

function outline(corners: readonly (readonly [number, number])[]): string {
  return `M${corners.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;
}

function picture(mesh: Mesh, content: string): string {
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${mesh.w} ${mesh.h}' preserveAspectRatio='none'>` +
    `${content}</svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23")}")`;
}

/** Facets of the big card, lit from the upper left (the card at rest). */
export const FACETS = "hero1-facets";
/** The same facets lit from the upper right. */
export const FACETS_TILTED = "hero1-facets-tilted";
/**
 * Added to either of the two when a photo fills the zone: in place of the
 * facets, the frame every special card keeps around a photo (../../photoMount).
 */
export const FACETS_MOUNT = "hero1-facets-mount";
/** Facets of the mini card. */
export const FACETS_MINI = "hero1-facets-mini";

const FILL = `background-color:${AMETHYST};background-size:100% 100%;background-repeat:no-repeat`;
const BIG_CSS =
  `.${FACETS},.${FACETS_TILTED}{${FILL}}` +
  `.${FACETS}{background-image:${facetPicture(BIG, false, 0.3)}}` +
  `.${FACETS_TILTED}{background-image:${facetPicture(BIG, true, 0.3)}}` +
  `.${FACETS_MOUNT}{-webkit-mask-image:${MOUNT_MASK};mask-image:${MOUNT_MASK};` +
  `-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}` +
  `.${FACETS}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT_MESH, false, MOUNT_EDGE, true)}}` +
  `.${FACETS_TILTED}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT_MESH, true, MOUNT_EDGE, true)}}`;
const MINI_CSS = `.${FACETS_MINI}{${FILL};background-image:${facetPicture(MINI, false, 1.1)}}`;

/**
 * Puts the facet pictures in the page. React keeps one copy per `href` in
 * <head>, however many cards render this.
 */
export function HeroFacetStyles({ mini = false }: { mini?: boolean }) {
  return (
    <style href={mini ? "hero1-facets-mini" : "hero1-facets-big"} precedence="medium">
      {mini ? MINI_CSS : BIG_CSS}
    </style>
  );
}
