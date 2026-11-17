// The «Ομάδα της Εβδομάδας» (Team of the Week) finish: its colours and the
// faceted deep-red surface of the card's upper zone. Shared by the big card
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

/** The whole lower half — name and numbers — and the card behind a photo: one black. */
export const ONYX = "#0A0A0A";
/** Last name and the six numbers. */
export const SNOW = "#FFF4F1";
/** First name, the small labels, the edition mark: the red, lifted until it reads on black. */
export const EMBER = "#EF4B47";
/** The one thin line above the name: the rim's red, a shade deeper, so it stays quiet on the black. */
export const RULE = "#9A0F16";
/** The ring round the team logo. */
export const RING_RED = "#D4221F";
/** Fill of the upper zone before the facets have painted. */
const CRIMSON = "#8A0A11";

/** Thin rim: one deep red, barely lighter where the light catches it. */
export const TOTW_RIM =
  "conic-gradient(from 124deg at 50% 50%, #9C0D14 0%, #B01219 18%, #CC2422 30%, #AC1118 46%, #960C13 62%, #C21C1E 78%, #B01219 90%, #9C0D14 100%)";
/** Flat version of the rim for the mini card. */
export const TOTW_RIM_FLAT = "linear-gradient(150deg, #A81017 0%, #CC2422 38%, #AE1218 66%, #C21C1E 100%)";

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

// 46 facets for the big card: long uneven shards, most of them leaning the
// same way, like crumpled foil. The ones in the four corners lean toward the
// light, because they are all that is left of the metal when a photo takes
// the zone.
const BIG: Mesh = {
  w: 100,
  h: 76,
  points: [
    [0, 0], [100, 0], [100, 76], [0, 76], [21.1, 0], [53, 0], [77.9, 0], [30.6, 76], [45, 76], [70.7, 76],
    [0, 19.6], [0, 46.2], [100, 29.1], [100, 44.7], [52.8, 19.7], [31.9, 33.6], [79.7, 44.9], [18.9, 61.8],
    [89.5, 56.8], [48.8, 54.3], [55.6, 33.5], [33.6, 13.5], [17.5, 37.4], [15.9, 20.4], [28.7, 49.8],
    [80.7, 22.5], [83.1, 69.4], [34.4, 63.1], [10.6, 7.9], [70, 12.9], [69, 61.4],
  ],
  facets: [
    [11, 22, 3, 0.83, 0], [5, 14, 21, -0.63, 0.32], [15, 22, 21, 0.38, -0.66], [14, 15, 21, -0.2, 0.77],
    [1, 25, 6, -0.5, -0.2], [28, 10, 0, 0.61, -0.01], [23, 22, 11, -0.09, 0.81], [10, 23, 11, -0.29, 0.09],
    [23, 10, 28, 0.46, 0.09], [22, 23, 21, -0.45, 0.79], [25, 29, 6, 0.01, 0.85], [29, 5, 6, 0.35, -0.45],
    [5, 29, 14, 0.79, -0.03], [30, 9, 8, -0.47, 0.05], [12, 25, 1, -0.86, 0.21], [25, 12, 16, -0.41, -0.1],
    [9, 26, 2, -0.43, 0.43], [30, 26, 9, 0.24, 0.63], [23, 4, 21, 0.81, 0.18], [4, 23, 28, 0.16, 0.33],
    [4, 5, 21, -0.42, -0.26], [4, 28, 0, 0.47, -0.41], [24, 15, 14, -0.83, -0.11], [15, 24, 22, 0.17, 0.76],
    [7, 27, 8, -0.34, -0.47], [29, 20, 14, 0.3, -0.08], [20, 24, 14, 0.25, -0.3], [24, 20, 27, 0.21, -0.34],
    [20, 29, 25, 0.59, 0.21], [20, 25, 16, 0.42, -0.21], [18, 13, 2, -0.69, 0.06], [26, 18, 2, -0.4, -0.3],
    [18, 12, 13, 0.59, 0.04], [12, 18, 16, 0.03, -0.52], [18, 30, 16, 0.06, 0.33], [18, 26, 30, -0.18, -0.55],
    [17, 7, 3, 0.2, -0.6], [22, 17, 3, 0.72, 0.53], [24, 17, 22, 0.76, -0.35], [17, 24, 27, 0.36, -0.65],
    [7, 17, 27, -0.13, -0.72], [19, 30, 8, -0.39, -0.25], [27, 19, 8, 0.52, 0.57], [20, 19, 27, -0.28, -0.19],
    [30, 19, 16, -0.44, -0.54], [19, 20, 16, -0.8, -0.06],
  ],
};

// 14 facets for the mini card: at 56px the big mesh would turn into noise.
const MINI: Mesh = {
  w: 100,
  h: 84,
  points: [
    [0, 0], [100, 0], [100, 84], [0, 84], [39.3, 0], [56.1, 84], [0, 45.6], [100, 41.4], [25, 63.1], [50.4, 23],
    [75.9, 22.7], [72.4, 60.9],
  ],
  facets: [
    [5, 11, 2, -0.68, -0.38], [11, 9, 10, 0.44, 0.42], [8, 5, 3, 0.2, -0.38], [6, 8, 3, 0.78, -0.41],
    [8, 6, 9, -0.45, 0.29], [11, 8, 9, -0.53, 0.17], [8, 11, 5, 0.55, -0.02], [4, 6, 0, 0.36, 0.06],
    [6, 4, 9, -0.19, -0.93], [9, 4, 10, -0.62, 0.02], [4, 1, 10, -0.75, -0.25], [1, 7, 10, 0.12, 0.69],
    [7, 11, 10, -0.66, -0.24], [11, 7, 2, 0.17, 0.37],
  ],
};

// Dark → light. From the red-black of the facets in shade to a full red on
// the ones that catch the light. One hue all the way, and it stops at red:
// no orange, no pink, no pale highlight.
const TONES: readonly (readonly [number, number, number, number])[] = [
  [0, 0x18, 0x02, 0x04],
  [0.18, 0x32, 0x04, 0x07],
  [0.35, 0x56, 0x07, 0x0c],
  [0.5, 0x78, 0x0a, 0x10],
  [0.65, 0x98, 0x0e, 0x14],
  [0.8, 0xb2, 0x14, 0x19],
  [0.92, 0xc2, 0x1c, 0x1e],
  [1, 0xcc, 0x24, 0x22],
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
 * the facets' own lean counts: a lamp on the upper left, deep shade on the
 * right, a little shade along the bottom.
 */
function ambient(x: number, y: number): number {
  return 0.46 + 0.3 * bump(x, y, 0.3, 0.24, 0.26) - 0.17 * bump(x, y, 0.98, 0.56, 0.3) - 0.06 * bump(x, y, 0.5, 1.05, 0.28);
}

/**
 * The mesh as a CSS `url("data:…")` picture. `fromRight` paints the same
 * facets with the light on the other side — the big card fades between the
 * two as it is tilted. `lift` brightens the whole surface. `mirror` paints
 * the left half of the picture a second time, mirrored onto the right: for
 * the frame around a photo (`MOUNT`), of which only the left side is written
 * down.
 */
function facetPicture(mesh: Mesh, fromRight: boolean, edgeWidth: number, lift = 0, mirror = false): string {
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
    const value = ambient(fromRight ? 1 - across : across, cy / mesh.h) + lift + 0.36 * facing;

    // Each facet also shades a little across itself, lighter on the side
    // nearer the light — that is what makes it read as folded metal and not
    // as flat coloured paper.
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
    // The edges: a lit facet's edges catch a little light (a faint red line),
    // a facet in shade has a dark crease around it instead.
    const lit = value > 0.5;
    const strength = lit
      ? Math.min(0.3, 0.06 + (value - 0.5) * 0.7)
      : Math.min(0.55, 0.16 + (0.5 - value) * 1.1);
    shapes.push({
      value,
      path:
        `<path d='${outline(corners)}' fill='url(#f${i})'${lit ? "" : " stroke='#120102'"} ` +
        `stroke-opacity='${n2(strength)}'/>`,
    });
  });

  // Darkest first, so the bright facets' lines end up on top.
  shapes.sort((p, q) => p.value - q.value);

  // Over the facets, in the same picture: the lamp's soft spot and the shade
  // opposite it. They belong to the metal, so they are cut with it when a
  // photo takes the zone.
  const spotX = fromRight ? 0.7 : 0.3;
  const shadeX = fromRight ? 0 : 1;
  const box = `width='${mesh.w}' height='${mesh.h}'`;
  const metal =
    `<g stroke='#E2463F' stroke-width='${edgeWidth}' stroke-linejoin='round'>${shapes.map((s) => s.path).join("")}</g>` +
    `<rect ${box} fill='url(#shade)'/><rect ${box} fill='url(#spot)'/>`;
  // Mirrored: the spot and the shade cover the whole picture, so each copy is
  // cut to its own half — otherwise the two would lie over each other.
  const half = `<g clip-path='url(#half)'>${metal}</g>`;
  return picture(
    mesh,
    `<defs>${gradients}` +
      `<radialGradient id='spot' cx='${spotX}' cy='.23' r='.4'><stop stop-color='#F0605A' stop-opacity='.16'/>` +
      `<stop offset='.42' stop-color='#E04842' stop-opacity='.08'/><stop offset='1' stop-color='#E04842' stop-opacity='0'/></radialGradient>` +
      `<radialGradient id='shade' cx='${shadeX}' cy='.6' r='.72'><stop stop-color='#0A0001' stop-opacity='.42'/>` +
      `<stop offset='1' stop-color='#0A0001' stop-opacity='0'/></radialGradient>` +
      `${mirror ? `<clipPath id='half'><rect width='${mesh.w / 2}' height='${mesh.h}'/></clipPath>` : ""}</defs>` +
      (mirror ? half + mirrored(half) : metal),
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
export const FACETS = "totw1-facets";
/** The same facets lit from the upper right. */
export const FACETS_TILTED = "totw1-facets-tilted";
/**
 * Added to either of the two when a photo fills the zone: in place of the
 * facets, the frame every special card keeps around a photo (../../photoMount).
 */
export const FACETS_MOUNT = "totw1-facets-mount";
/** Facets of the mini card. */
export const FACETS_MINI = "totw1-facets-mini";

const FILL = `background-color:${CRIMSON};background-size:100% 100%;background-repeat:no-repeat`;
// The frame's facets lean as they do on the «Θρύλος» card, where the ones in
// shade are still a clear dark gold. In this red they would be red-black and
// drop out of the frame on a dark photo, so the frame is lit a little more
// than the rest of the metal.
const MOUNT_LIFT = 0.12;
const BIG_CSS =
  `.${FACETS},.${FACETS_TILTED}{${FILL}}` +
  `.${FACETS}{background-image:${facetPicture(BIG, false, 0.3)}}` +
  `.${FACETS_TILTED}{background-image:${facetPicture(BIG, true, 0.3)}}` +
  `.${FACETS_MOUNT}{-webkit-mask-image:${MOUNT_MASK};mask-image:${MOUNT_MASK};` +
  `-webkit-mask-size:100% 100%;mask-size:100% 100%;-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat}` +
  `.${FACETS}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT, false, MOUNT_EDGE, MOUNT_LIFT, true)}}` +
  `.${FACETS_TILTED}.${FACETS_MOUNT}{background-image:${facetPicture(MOUNT, true, MOUNT_EDGE, MOUNT_LIFT, true)}}`;
const MINI_CSS = `.${FACETS_MINI}{${FILL};background-image:${facetPicture(MINI, false, 1.1, 0.04)}}`;

/**
 * Puts the facet pictures in the page. React keeps one copy per `href` in
 * <head>, however many cards render this.
 */
export function TotwFacetStyles({ mini = false }: { mini?: boolean }) {
  return (
    <style href={mini ? "totw1-facets-mini" : "totw1-facets-big"} precedence="medium">
      {mini ? MINI_CSS : BIG_CSS}
    </style>
  );
}
