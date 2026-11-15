// The «Θρύλος» (Legend) finish, version 2: its colours and the faceted
// pale-gold surface. Shared by the big card and the mini card.
//
// The facets are one folded SURFACE: every corner of the mesh has a height,
// and each facet takes its shade from the way it actually faces one light.
// So neighbouring facets shade together like creased metal, and the thin
// bright lines sit only on the creases that stand toward the viewer (the
// ridges), not on every edge.
//
// The picture is built once, when this module loads, and handed to the
// browser as a CSS background: a card adds no elements for it, and the
// picture's text is in the page once (one <style>) however many cards there
// are.

// ───────────────────────────────────────────────────────────────────────
// Colours
// ───────────────────────────────────────────────────────────────────────

/** The plate under the name and the numbers: warm ivory, not paper white. */
export const IVORY = "#FCFAF1";
/** The plate toward its left and right edge. */
export const CREAM = "#F3EEDC";
/** The plate at the very point of the shield. */
export const TIP = "#E6DEC0";
/** Last name and the six numbers. */
export const INK = "#2A2311";
/** First name, the small labels, the edition mark. */
export const BRONZE = "#74581A";
/** Gold lines: the two rules around the name and the line around the photo. */
export const GOLD_LINE =
  "linear-gradient(90deg, #C6A94F 0%, #DCC98C 24%, #BFA147 50%, #D9C583 76%, #C6A94F 100%)";
/** Fill of the faceted zone before its picture has painted. */
const CHAMPAGNE = "#D8CE8F";

/** Thin rim: deeper and more yellow than anything on the face. */
export const LEGEND_RIM =
  "conic-gradient(from 124deg at 50% 50%, #B8981F 0%, #C9AA24 18%, #DFCD4C 30%, #C3A423 46%, #B39220 62%, #D8BD3E 78%, #C9AA24 90%, #B8981F 100%)";
/** Flat version of the rim for the mini card. */
export const LEGEND_RIM_FLAT = "linear-gradient(150deg, #B8981F 0%, #DFCD4C 38%, #C3A423 66%, #D8BD3E 100%)";

// ───────────────────────────────────────────────────────────────────────
// Facets
// ───────────────────────────────────────────────────────────────────────

type Vec = readonly [number, number, number];

type Mesh = {
  w: number;
  h: number;
  /** How tall the folds are, in the mesh's own units. */
  relief: number;
  /** x, y, and height (-1…1, toward the viewer). */
  points: readonly Vec[];
  /** Three point indices. */
  facets: readonly Vec[];
};

// 51 facets for the big card's upper zone. Its corners were placed so that
// the facets of the two top corners and of the sides are whole where a photo
// leaves them showing, and the middle (behind a photo, or behind the team
// logo) is a few large ones.
const BIG: Mesh = {
  w: 100,
  h: 80,
  relief: 9,
  points: [
    [0, 0, -0.53], [12.6, 0, -0.21], [30.9, 0, -0.87], [51.4, 0, 0.84], [71.8, 0, 0.53], [84.3, 0, 0.07],
    [100, 0, -0.45], [0, 80, -0.65], [14.2, 80, -0.57], [43, 80, 0.66], [64.1, 80, 0.6], [80.9, 80, -0.38],
    [100, 80, 0.25], [0, 14.4, 0.71], [0, 31.3, -0.83], [0, 45.6, 0.34], [0, 61, -0.64], [100, 13.8, -0.82],
    [100, 33.6, 0.73], [100, 47.3, -0.4], [100, 65.5, 0.14], [11.5, 23.1, 0.02], [89.7, 20.6, -0.14],
    [23.6, 22.2, 0.63], [34.3, 9.6, 0.25], [74.1, 24.1, -0.06], [62.1, 13, -0.61], [13.2, 44.9, 0.27],
    [12.6, 63, 0.49], [85.8, 48.4, 0.81], [84.9, 61.9, -0.54], [52.1, 14.5, -0.53], [36.6, 30.4, -0.08],
    [58.3, 32.6, 0.79], [53.6, 51.9, 0.92], [29.1, 58.3, 0.93], [69.2, 58.3, 0.89],
  ],
  facets: [
    [35, 28, 27], [4, 26, 3], [28, 8, 7], [8, 35, 9], [35, 8, 28], [16, 28, 7], [16, 15, 27], [28, 16, 27],
    [34, 10, 9], [35, 34, 9], [26, 31, 3], [31, 26, 33], [1, 13, 0], [15, 14, 27], [24, 2, 3], [31, 24, 3],
    [24, 1, 2], [1, 24, 23], [32, 31, 33], [34, 32, 33], [24, 32, 23], [32, 24, 31], [32, 34, 35], [23, 32, 27],
    [32, 35, 27], [17, 5, 6], [17, 22, 5], [22, 17, 18], [5, 25, 4], [22, 25, 5], [25, 26, 4], [26, 25, 33],
    [21, 1, 23], [1, 21, 13], [21, 14, 13], [21, 23, 27], [14, 21, 27], [11, 20, 12], [30, 20, 11], [36, 11, 10],
    [36, 30, 11], [34, 36, 10], [36, 34, 33], [29, 22, 18], [29, 25, 22], [36, 29, 30], [25, 29, 33], [29, 36, 33],
    [19, 29, 18], [19, 20, 30], [29, 19, 30],
  ],
};

// 19 facets for the mini card: at 56px the big mesh would turn into noise.
const MINI: Mesh = {
  w: 100,
  h: 96,
  relief: 14,
  points: [
    [0, 0, -0.53], [38.7, 0, -0.21], [100, 0, -0.69], [0, 96, -0.87], [28.8, 96, 0.84], [71.6, 96, 0.53],
    [100, 96, -0.56], [0, 30.4, -0.45], [0, 58.1, -0.79], [100, 32.6, 0.85], [100, 69.9, 0.61], [27, 20.9, -0.38],
    [75.3, 24.3, 0.71], [25.8, 57.9, 0.21], [79.7, 60.1, -0.64], [49.7, 39.9, 0.87],
  ],
  facets: [
    [7, 13, 8], [13, 5, 4], [8, 13, 3], [13, 4, 3], [9, 12, 2], [12, 1, 2], [1, 12, 15], [11, 1, 15], [13, 11, 15],
    [11, 13, 7], [11, 7, 0], [1, 11, 0], [12, 14, 15], [14, 12, 9], [14, 13, 15], [13, 14, 5], [10, 14, 9],
    [5, 10, 6], [14, 10, 5],
  ],
};

// Dark → light: the tones of the surface, from its deepest tan to its palest
// cream, spaced the way they are spread on the reference.
const TONES: readonly (readonly [number, number, number, number])[] = [
  [0, 0xa8, 0x88, 0x45],
  [0.12, 0xb4, 0x99, 0x58],
  [0.25, 0xbf, 0xac, 0x5c],
  [0.4, 0xcb, 0xbd, 0x73],
  [0.55, 0xd8, 0xce, 0x8f],
  [0.7, 0xe1, 0xd9, 0xb2],
  [0.85, 0xea, 0xe4, 0xbd],
  [0.95, 0xf5, 0xf0, 0xcf],
  [1, 0xfc, 0xf9, 0xe8],
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
 * The broad light on the zone (x, y 0…1), before the folds count: brightest
 * in the upper left, a little shade at the left edge and low on the right.
 */
function ambient(x: number, y: number): number {
  return 0.1 * bump(x, y, 0.3, 0.22, 0.28) - 0.07 * bump(x, y, 0.03, 0.55, 0.2) - 0.06 * bump(x, y, 0.95, 0.6, 0.22);
}

const unit = ([x, y, z]: Vec): Vec => {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
};
const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** The corner in space: the height scaled by the mesh's relief. */
const corner = (mesh: Mesh, i: number): Vec => [mesh.points[i][0], mesh.points[i][1], mesh.points[i][2] * mesh.relief];

/** The way a facet faces, always toward the viewer. */
function facing(mesh: Mesh, [a, b, c]: Vec): Vec {
  const A = corner(mesh, a);
  const B = corner(mesh, b);
  const C = corner(mesh, c);
  const u: Vec = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  const v: Vec = [C[0] - A[0], C[1] - A[1], C[2] - A[2]];
  const n: Vec = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  return unit(n[2] < 0 ? [-n[0], -n[1], -n[2]] : n);
}

const n1 = (k: number) => String(Math.round(k * 10) / 10);
const n2 = (k: number) => String(Math.round(k * 100) / 100);

/**
 * The mesh as a CSS `url("data:…")` picture, lit from the upper left, or from
 * the upper right with `fromRight` — the big card fades between the two as it
 * is tilted. `line` is the width of the ridge lines in mesh units.
 */
function facetPicture(mesh: Mesh, fromRight: boolean, line: number): string {
  const light = unit([fromRight ? 0.58 : -0.58, -0.62, 0.55]);
  const normals = mesh.facets.map((f) => facing(mesh, f));

  // How bright each facet is.
  const values = mesh.facets.map(([a, b, c], i) => {
    const cx = (mesh.points[a][0] + mesh.points[b][0] + mesh.points[c][0]) / 3 / mesh.w;
    const cy = (mesh.points[a][1] + mesh.points[b][1] + mesh.points[c][1]) / 3 / mesh.h;
    return 0.57 + 0.72 * (dot(normals[i], light) - light[2]) + ambient(fromRight ? 1 - cx : cx, cy);
  });

  let gradients = "";
  let shapes = "";
  mesh.facets.forEach(([a, b, c], i) => {
    const corners = [mesh.points[a], mesh.points[b], mesh.points[c]];
    const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
    const cy = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;
    // Each facet also shades a little across itself, lighter on its side
    // nearer the light: folded metal, not flat coloured paper.
    const [nx, ny] = normals[i];
    const lean = Math.hypot(nx, ny);
    const toLight = nx * light[0] + ny * light[1] >= 0 ? 1 : -1;
    const ux = lean > 0.01 ? (nx / lean) * toLight : light[0];
    const uy = lean > 0.01 ? (ny / lean) * toLight : light[1];
    const along = corners.map(([x, y]) => (x - cx) * ux + (y - cy) * uy);
    const far = Math.min(...along);
    const near = Math.max(...along);
    gradients +=
      `<linearGradient id='f${i}' gradientUnits='userSpaceOnUse' ` +
      `x1='${n1(cx + ux * far)}' y1='${n1(cy + uy * far)}' x2='${n1(cx + ux * near)}' y2='${n1(cy + uy * near)}'>` +
      `<stop stop-color='#${tone(values[i] - 0.075)}'/><stop offset='1' stop-color='#${tone(values[i] + 0.075)}'/></linearGradient>`;
    // The facet is outlined in its own colour, so no seam shows between two.
    shapes +=
      `<path d='M${corners.map(([x, y]) => `${n1(x)} ${n1(y)}`).join("L")}Z' ` +
      `fill='url(#f${i})' stroke='#${tone(values[i])}'/>`;
  });

  // Ridges: the edges where the surface folds toward the viewer catch the
  // light as a thin pale line, clearer the sharper the fold and the brighter
  // the facets beside it. Valleys get none.
  const sides = new Map<string, { facet: number; opposite: number }[]>();
  mesh.facets.forEach(([a, b, c], facet) => {
    for (const [p, q, opposite] of [[a, b, c], [b, c, a], [c, a, b]]) {
      const key = p < q ? `${p} ${q}` : `${q} ${p}`;
      sides.set(key, [...(sides.get(key) ?? []), { facet, opposite }]);
    }
  });
  let ridges = "";
  for (const [key, pair] of sides) {
    if (pair.length !== 2) continue;
    const [p, q] = key.split(" ").map(Number);
    const from = corner(mesh, p);
    const across = corner(mesh, pair[1].opposite);
    const reach: Vec = [across[0] - from[0], across[1] - from[1], across[2] - from[2]];
    const fold = -dot(normals[pair[0].facet], reach) / (Math.hypot(...reach) || 1);
    if (fold <= 0.02) continue;
    const lit = Math.max(values[pair[0].facet], values[pair[1].facet]);
    const strength = Math.min(0.95, (0.25 + fold * 2.2) * (0.45 + lit * 0.8));
    ridges +=
      `<path d='M${n1(mesh.points[p][0])} ${n1(mesh.points[p][1])}L${n1(mesh.points[q][0])} ${n1(mesh.points[q][1])}' ` +
      `stroke-opacity='${n2(strength)}'/>`;
  }

  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${mesh.w} ${mesh.h}' preserveAspectRatio='none'>` +
    `<defs>${gradients}</defs>` +
    `<g stroke-width='0.35' stroke-linejoin='round'>${shapes}</g>` +
    `<g stroke='#FFFDF0' stroke-width='${line}' stroke-linecap='round'>${ridges}</g></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23")}")`;
}

/** Facets of the big card, lit from the upper left (the card at rest). */
export const FACETS = "legend2-facets";
/** The same facets lit from the upper right. */
export const FACETS_TILTED = "legend2-facets-tilted";
/** Facets of the mini card. */
export const FACETS_MINI = "legend2-facets-mini";

const FILL = `background-color:${CHAMPAGNE};background-size:100% 100%;background-repeat:no-repeat`;
const BIG_CSS =
  `.${FACETS},.${FACETS_TILTED}{${FILL}}` +
  `.${FACETS}{background-image:${facetPicture(BIG, false, 0.32)}}` +
  `.${FACETS_TILTED}{background-image:${facetPicture(BIG, true, 0.32)}}`;
const MINI_CSS = `.${FACETS_MINI}{${FILL};background-image:${facetPicture(MINI, false, 1.3)}}`;

/**
 * Puts the facet pictures in the page. React keeps one copy per `href` in
 * <head>, however many cards render this.
 */
export function LegendFacetStyles({ mini = false }: { mini?: boolean }) {
  return (
    <style href={mini ? "legend2-facets-mini" : "legend2-facets-big"} precedence="medium">
      {mini ? MINI_CSS : BIG_CSS}
    </style>
  );
}
