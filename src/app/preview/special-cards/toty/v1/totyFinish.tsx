// The «Ομάδα της Χρονιάς» (Team of the Year) finish: its colours, the faceted
// blue surface of the card's upper zone, and the two pictures of its black
// lower half (the satin band and the striped plate). Shared by the big card
// and the mini card.
//
// The facets are a small triangle mesh that is turned into an SVG picture
// once, when this module loads, and given to the browser as a CSS background.
// A card therefore adds no elements for them, and the picture's text is in
// the page once (one <style>, however many cards there are) instead of once
// per card.

import { MOUNT, MOUNT_EDGE, MOUNT_MASK, mirrored } from "../../photoMount";

// ───────────────────────────────────────────────────────────────────────
// Colours
// ───────────────────────────────────────────────────────────────────────

/** The plate under the numbers: near black. */
export const PLATE = "#0D0D0D";
/** Last name and the six numbers. */
export const WHITE = "#FFFFFF";
/** First name, the small labels, the edition mark: the facets' blue, lifted until it reads on black. */
export const AZURE = "#4F9BE0";
/** The rim's silver. */
export const SILVER = "#D8D8D8";
/** Fill of the upper zone before the facets have painted. */
const ROYAL = "#014A88";

/** Thin rim: silver-white. */
export const TOTY_RIM =
  "conic-gradient(from 124deg at 50% 50%, #C3C8CE 0%, #D8D8D8 18%, #FFFFFF 30%, #CDD1D6 46%, #B4C0C9 62%, #F1F3F5 78%, #D8D8D8 90%, #C3C8CE 100%)";
/** Flat version of the rim for the mini card. */
export const TOTY_RIM_FLAT = "linear-gradient(150deg, #C3C8CE 0%, #FFFFFF 38%, #B4C0C9 66%, #ECEFF2 100%)";
/** The hair of lighter colour just inside the rim: blue beside the upper zone, charcoal beside the black. */
export const TOTY_INNER_LINE = "linear-gradient(to bottom, #175D99 0%, #1D3D59 54.5%, #1A1A1A 55.5%, #1A1A1A 100%)";

/**
 * The band the name sits on: black satin that catches the light in the
 * middle (charcoal there, black at both ends).
 */
export const BAND =
  "linear-gradient(90deg, #020202 0%, #0D0D0D 13%, #1E1E1E 26%, #2E2E2E 39%, #343434 50%, #2E2E2E 61%, #1E1E1E 74%, #0D0D0D 87%, #020202 100%)";

/**
 * The plate: near black with three wide, soft, pure-black diagonal stripes in
 * its left part; the right part is plain.
 */
export const STRIPES =
  "linear-gradient(57deg, #000 0%, #000 9%, #0D0D0D 12%, #0D0D0D 20%, #000 23%, #000 32.5%, " +
  "#0D0D0D 35.5%, #0D0D0D 43.5%, #000 46.5%, #000 55.5%, #0D0D0D 58.5%, #0D0D0D 100%)";

/** Laid over the plate at the foot of the card: lifts black to #0C0C0C and the plate to #181818. */
export const FOOT_VEIL = "rgba(255,255,255,0.047)";

// ───────────────────────────────────────────────────────────────────────
// Facets
// ───────────────────────────────────────────────────────────────────────

type Mesh = {
  w: number;
  h: number;
  points: readonly (readonly [number, number])[];
  /** Three point indices, then which way the facet leans (x, y; each -1…1). */
  facets: readonly (readonly [number, number, number, number, number])[];
};

// 59 facets for the big card: larger ones in the upper left, smaller ones low
// and at the sides. The same mesh as the «Θρύλος» card.
const BIG: Mesh = {
  w: 100,
  h: 76,
  points: [
    [0, 0], [100, 0], [100, 76], [0, 76], [27.5, 0], [54, 0], [75.3, 0], [20.1, 76], [38.9, 76], [65, 76],
    [77.9, 76], [0, 15.3], [0, 35.5], [0, 54.5], [100, 17.2], [100, 35.5], [100, 52.8], [34.3, 25.7],
    [56.2, 18.5], [11.4, 18.6], [71, 57.8], [40.6, 48.3], [31.9, 65.1], [90.9, 20.5], [54.1, 53.1],
    [77.1, 30.8], [17.5, 46.3], [82.9, 63.5], [66, 8.3], [84.1, 50], [46.2, 66.1], [64.8, 41.6], [90.1, 34.9],
    [65.7, 68.2], [43.1, 6.7], [94.5, 66.3], [88.8, 7], [14.6, 69.6], [7.2, 60.2],
  ],
  facets: [
    [15, 16, 32, -0.48, -0.09], [30, 22, 21, -0.31, 0.18], [22, 30, 8, 0.6, -0.68], [22, 26, 21, -0.57, 0.16],
    [26, 17, 21, 0.81, 0.38], [37, 26, 22, 0.35, 0.54], [18, 31, 21, 0.75, -0.56], [17, 18, 21, 0.49, 0.24],
    [18, 25, 31, -0.12, -0.82], [4, 19, 0, -0.37, 0.62], [19, 4, 17, -0.89, 0.26], [19, 26, 12, 0.75, -0.58],
    [26, 19, 17, -0.17, -0.76], [36, 6, 1, -0.11, -0.44], [14, 36, 1, -0.43, -0.51], [16, 29, 32, -0.51, 0.17],
    [29, 25, 32, -0.21, 0.59], [31, 29, 20, 0.74, -0.67], [25, 29, 31, -0.67, 0.22], [24, 31, 20, 0.21, -0.52],
    [31, 24, 21, 0.69, -0.01], [24, 30, 21, 0.42, 0.39], [33, 24, 20, -0.7, -0.68], [24, 33, 30, -0.32, 0.51],
    [7, 22, 8, -0.42, 0.11], [7, 37, 22, 0.88, 0.03], [37, 7, 3, 0.72, 0.41], [26, 13, 12, 0.46, -0.78],
    [18, 34, 5, 0.68, 0.04], [34, 18, 17, 0.42, 0.04], [34, 4, 5, -0.09, 0.64], [4, 34, 17, -0.3, 0.32],
    [6, 28, 5, -0.75, 0.25], [28, 18, 5, -0.39, 0.7], [18, 28, 25, -0.33, 0.8], [36, 28, 6, -0.22, -0.62],
    [19, 11, 0, -0.28, 0.46], [11, 19, 12, 0.06, 0.36], [23, 36, 14, -0.82, -0.06], [25, 23, 32, -0.59, 0.31],
    [28, 23, 25, 0.5, -0.2], [23, 28, 36, -0.81, 0.44], [23, 14, 15, 0.04, -0.45], [23, 15, 32, -0.59, 0.4],
    [10, 35, 2, -0.08, 0.85], [35, 16, 2, 0.14, -0.35], [35, 29, 16, -0.3, -0.19], [9, 33, 10, -0.35, 0.01],
    [30, 9, 8, -0.28, -0.3], [33, 9, 30, 0.77, 0.26], [38, 26, 37, 0.54, 0.2], [38, 13, 26, 0.7, 0.18],
    [13, 38, 3, 0.07, 0.62], [38, 37, 3, -0.18, -0.68], [27, 35, 10, -0.17, -0.87], [27, 33, 20, 0.21, 0.49],
    [33, 27, 10, 0.35, 0.8], [29, 27, 20, -0.39, -0.29], [35, 27, 29, 0.05, 0.42],
  ],
};

// 17 facets for the mini card: at 56px the big mesh would turn into noise.
const MINI: Mesh = {
  w: 100,
  h: 84,
  points: [
    [0, 0], [100, 0], [100, 84], [0, 84], [43.4, 0], [40.7, 84], [60.7, 84], [0, 46.1], [100, 33.6],
    [23.8, 52.2], [49.5, 19.8], [79.7, 12.4], [67.1, 56.6], [18.9, 14.7],
  ],
  facets: [
    [11, 4, 1, -0.56, -0.31], [4, 11, 10, 0.45, 0.45], [8, 11, 1, -0.12, -0.81], [11, 12, 10, -0.6, 0.11],
    [12, 11, 8, -0.32, 0.38], [12, 8, 2, 0.21, 0.61], [13, 7, 0, 0.64, 0.52], [4, 13, 0, -0.19, -0.72],
    [13, 4, 10, 0.58, 0.08], [6, 12, 2, -0.37, 0.17], [12, 6, 5, 0.82, -0.17], [9, 13, 10, -0.81, -0.01],
    [13, 9, 7, 0.15, 0.48], [12, 9, 10, -0.82, -0.13], [9, 12, 5, -0.21, -0.28], [9, 5, 3, -0.71, -0.61],
    [7, 9, 3, -0.04, -0.95],
  ],
};

// The mini card with a photo: nothing but four small faceted corners, three
// facets each, like the corner mounts of the big card. The rest of the
// picture is empty, so the photo shows.
const MINI_CORNERS: Mesh = {
  w: 100,
  h: 84,
  points: [
    [0, 0], [33, 0], [0, 30], [12, 10],
    [100, 0], [67, 0], [100, 30], [88, 10],
    [0, 84], [0, 56], [29, 84], [11, 75],
    [100, 84], [100, 56], [71, 84], [89, 75],
  ],
  facets: [
    [0, 1, 3, -0.2, -0.75], [0, 3, 2, -0.8, -0.1], [1, 2, 3, 0.55, 0.5],
    [4, 7, 5, 0.3, -0.8], [4, 6, 7, 0.7, -0.35], [5, 7, 6, -0.6, 0.45],
    [8, 9, 11, -0.75, 0.2], [8, 11, 10, -0.2, 0.7], [9, 10, 11, 0.5, -0.6],
    [12, 15, 13, 0.6, 0.3], [12, 14, 15, 0.15, 0.8], [13, 15, 14, -0.65, -0.55],
  ],
};

// Dark → light: from the deepest navy to the brightest blue of the surface.
const TONES: readonly (readonly [number, number, number, number])[] = [
  [0, 0x01, 0x1b, 0x32],
  [0.14, 0x01, 0x25, 0x45],
  [0.3, 0x01, 0x38, 0x68],
  [0.42, 0x01, 0x43, 0x7c],
  [0.52, 0x01, 0x4a, 0x88],
  [0.64, 0x03, 0x56, 0x9d],
  [0.78, 0x10, 0x67, 0xb2],
  [0.9, 0x1c, 0x73, 0xbe],
  [1, 0x25, 0x7c, 0xc6],
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
 * the facets' own lean counts: bright blue on the left, where the light
 * comes from, falling into navy toward the right and a little toward the
 * bottom, with one more bright patch low on the left.
 */
function ambient(x: number, y: number): number {
  const shade = 1 / (1 + Math.exp(-(x - 0.56) / 0.17));
  return 0.8 - 0.48 * shade - 0.1 * y + 0.1 * bump(x, y, 0.1, 0.95, 0.2);
}

/** The mini card's photo corners: all four clearly blue, the left pair a little brighter. */
const cornerAmbient = (x: number) => 0.74 - 0.2 * x;

/**
 * The mesh as a CSS `url("data:…")` picture. `fromRight` paints the same
 * facets with the light on the other side — the big card fades between the
 * two as it is tilted. `mirror` paints the facets a second time, mirrored
 * onto the right: for the frame around a photo (`MOUNT`), of which only the
 * left side is written down.
 */
function facetPicture(
  mesh: Mesh,
  fromRight: boolean,
  edgeWidth: number,
  light: (x: number, y: number) => number = ambient,
  mirror = false,
): string {
  const lightX = fromRight ? 0.7 : -0.7;
  const lightY = -0.7;
  let gradients = "";
  const shapes: { value: number; path: string }[] = [];

  mesh.facets.forEach(([a, b, c, leanX, leanY], i) => {
    const corners = [mesh.points[a], mesh.points[b], mesh.points[c]];
    const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
    const cy = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
    const facing = leanX * lightX + leanY * lightY;
    const across = cx / mesh.w;
    const value = light(fromRight ? 1 - across : across, cy / mesh.h) + 0.34 * facing;

    // Each facet also shades a little across itself, lighter on the side
    // nearer the light — that is what makes it read as a folded surface and
    // not as flat coloured paper.
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
      `<stop stop-color='#${tone(value - 0.11)}'/><stop offset='1' stop-color='#${tone(value + 0.11)}'/></linearGradient>`;
    // The edges catch a little light, and only around the facets that are
    // lit: there is no bright outline anywhere on this surface.
    const glint = Math.min(0.5, Math.max(0.06, 0.06 + (value - 0.35) * 0.8));
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
      `<g stroke='#4A93DB' stroke-width='${edgeWidth}' stroke-linejoin='round'>` +
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
export const FACETS = "toty1-facets";
/** The same facets lit from the upper right. */
export const FACETS_TILTED = "toty1-facets-tilted";
/**
 * Added to either of the two when a photo fills the zone: in place of the
 * facets, the frame every special card keeps around a photo (../../photoMount).
 */
export const FACETS_MOUNT = "toty1-facets-mount";
/** Facets of the mini card without a photo. */
export const FACETS_MINI = "toty1-facets-mini";
/** The four faceted corners the mini card lays over a photo. */
export const FACETS_MINI_CORNERS = "toty1-facets-mini-corners";

const STRETCH = "background-size:100% 100%;background-repeat:no-repeat";
const BIG_CSS =
  `.${FACETS},.${FACETS_TILTED}{background-color:${ROYAL};${STRETCH}}` +
  `.${FACETS}{background-image:${facetPicture(BIG, false, 0.3)}}` +
  `.${FACETS_TILTED}{background-image:${facetPicture(BIG, true, 0.3)}}` +
  `.${FACETS_MOUNT}{-webkit-mask-image:${MOUNT_MASK};mask-image:${MOUNT_MASK};` +
  `-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}` +
  `.${FACETS}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT, false, MOUNT_EDGE, ambient, true)}}` +
  `.${FACETS_TILTED}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT, true, MOUNT_EDGE, ambient, true)}}`;
const MINI_CSS =
  `.${FACETS_MINI}{background-color:${ROYAL};${STRETCH};background-image:${facetPicture(MINI, false, 1.1)}}` +
  `.${FACETS_MINI_CORNERS}{${STRETCH};background-image:${facetPicture(MINI_CORNERS, false, 1.1, cornerAmbient)}}`;

/**
 * Puts the facet pictures in the page. React keeps one copy per `href` in
 * <head>, however many cards render this.
 */
export function TotyFacetStyles({ mini = false }: { mini?: boolean }) {
  return (
    <style href={mini ? "toty1-facets-mini" : "toty1-facets-big"} precedence="medium">
      {mini ? MINI_CSS : BIG_CSS}
    </style>
  );
}
