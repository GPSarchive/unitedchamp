// The faceted «Όνυχας» surface: the default card's black, cut into facets like
// a piece of obsidian. Shared by the big card and the mini card.
//
// Built the way the edition finishes are (toty/v1/totyFinish.tsx): the facets
// are a small triangle mesh that is turned into an SVG picture once, when this
// module loads, and given to the browser as a CSS background. A card adds no
// elements for them, and the picture's text is in the page once (one <style>,
// however many cards there are).
//
// What is different here:
//   · the mesh covers the whole face, not an upper zone — the default card has
//     no band and no plate. So the stone is cut deep only where nothing is
//     written: around the logo, down both sides, a little at the tip. Behind
//     the logo it is calmer, and behind the name and the numbers it is almost
//     flat and as dark as the plain onyx, so they read as they always did;
//   · every point of the mesh has a height, and each facet's lean comes from
//     the heights of its three corners. The facets therefore fit together as
//     one folded surface, and the picture knows which edges are ridges (they
//     catch a hair of pale gold, the rim's colour) and which are valleys (a
//     thin dark line);
//   · the tones stay black: from under the plain onyx (#0b0b0d) to graphite on
//     the few facets that face the light squarely.

// ───────────────────────────────────────────────────────────────────────
// Colours
// ───────────────────────────────────────────────────────────────────────

/** «Όνυχας», the default card's flat surface. The face's fill before the facets have painted. */
export const ONYX = "#0b0b0d";

/** What a lit ridge glints in: the gold rim's palest tone, greyed. */
const RIDGE = "#E6CB8A";

// Dark → light. Neutral, a breath toward blue (as the plain onyx is), so the
// gold of the rim, the name and the ridges is the only warm thing on the card.
const TONES: readonly (readonly [number, number, number, number])[] = [
  [0, 0x04, 0x04, 0x05],
  [0.2, 0x07, 0x07, 0x09],
  [0.38, 0x0b, 0x0b, 0x0d],
  [0.52, 0x11, 0x11, 0x14],
  [0.66, 0x19, 0x19, 0x1d],
  [0.78, 0x22, 0x23, 0x28],
  [0.9, 0x2e, 0x2f, 0x35],
  [1, 0x3c, 0x3d, 0x44],
];

// ───────────────────────────────────────────────────────────────────────
// Facets
// ───────────────────────────────────────────────────────────────────────

type Mesh = {
  w: number;
  h: number;
  /** x, y, and the height of the surface there (about -1…1; higher = nearer the viewer). */
  points: readonly (readonly [number, number, number])[];
  /** Three point indices. */
  facets: readonly (readonly [number, number, number])[];
};

// 69 facets for the big card, over the whole face (5:7). Smaller and steeper
// at the top and down the sides, larger and nearly flat behind the name and
// the numbers, a little relief again at the tip. Slightly longer along one
// diagonal than across it, so they read as shards and not as a honeycomb.
const BIG: Mesh = {
  w: 100,
  h: 140,
  points: [
    [0, 0, 0.23], [100, 0, -0.38], [100, 140, 0.3], [0, 140, 0.31], [12.7, 0, -0.98], [26.4, 0, -0.34],
    [40.3, 0, -0.82], [54.7, 0, -0.73], [68, 0, -0.09], [83.4, 0, -0.4], [100, 13.1, -0.22], [100, 24.9, -0.17],
    [100, 38.5, 0.85], [100, 52, -0.19], [100, 65.2, 0.26], [100, 76.9, 0.5], [100, 96.5, 0.52],
    [100, 118.7, 0.53], [83.1, 140, -0.23], [59.7, 140, 0.46], [36.2, 140, 0], [13.5, 140, 0.69],
    [0, 123.5, 0.67], [0, 99.5, -0.24], [0, 79.3, -0.06], [0, 60.4, -0.12], [0, 48.1, 0.18], [0, 32.4, -0.75],
    [0, 20.3, -0.24], [36.2, 88.6, -0.02], [67.8, 93.6, 0.05], [15.2, 20.4, -0.9], [21.6, 112.2, -0.11],
    [76.7, 49.3, -0.12], [49.3, 20.7, -0.49], [57.6, 51, -0.05], [52, 110.9, 0.23], [38, 48.2, 0.34],
    [14.3, 58.6, -0.28], [66.4, 68.4, 0.13], [49.9, 67.3, 0.19], [24.2, 37.8, 0.3], [73.5, 30.7, -0.32],
    [30.8, 18.1, -0.47], [28.7, 61.1, 0.38], [84.5, 16.7, 0.19], [83.4, 65.5, -0.48], [16.9, 77.9, -0.22],
    [63.4, 15, 0.17], [87.3, 41.4, 0.77],
  ],
  facets: [
    [9, 1, 10], [17, 2, 18], [21, 3, 22], [16, 17, 30], [17, 18, 30], [27, 28, 31], [0, 4, 31], [28, 0, 31],
    [20, 21, 32], [21, 22, 32], [22, 23, 32], [6, 7, 34], [18, 19, 36], [30, 18, 36], [29, 30, 36],
    [19, 20, 36], [20, 32, 36], [32, 29, 36], [34, 35, 37], [25, 26, 38], [26, 27, 38], [35, 33, 39],
    [30, 29, 40], [39, 30, 40], [37, 35, 40], [35, 39, 40], [27, 31, 41], [38, 27, 41], [33, 35, 42],
    [35, 34, 42], [4, 5, 43], [31, 4, 43], [5, 6, 43], [6, 34, 43], [41, 31, 43], [34, 37, 43], [37, 41, 43],
    [40, 29, 44], [37, 40, 44], [38, 41, 44], [41, 37, 44], [9, 10, 45], [10, 11, 45], [8, 9, 45], [13, 14, 46],
    [14, 15, 46], [15, 16, 46], [16, 30, 46], [30, 39, 46], [39, 33, 46], [23, 24, 47], [32, 23, 47],
    [29, 32, 47], [24, 25, 47], [25, 38, 47], [38, 44, 47], [44, 29, 47], [7, 8, 48], [34, 7, 48], [42, 34, 48],
    [8, 45, 48], [45, 42, 48], [12, 13, 49], [33, 42, 49], [11, 12, 49], [45, 11, 49], [42, 45, 49],
    [13, 46, 49], [46, 33, 49],
  ],
};

// 27 facets for the mini card: at 56px the big mesh would turn into noise.
// Cut like a stone with a table: the middle, where the logo stands, is nearly
// flat (eight points at almost one height), and the surface falls away from it
// to the rim in a ring of facets — those are what shows around the logo.
const MINI: Mesh = {
  w: 100,
  h: 140,
  points: [
    [0, 0, -0.94], [100, 0, 0.28], [100, 140, -0.43], [0, 140, -0.31], [30, 0, -0.72], [66, 0, -0.83],
    [100, 34, -0.8], [100, 76, -0.65], [100, 112, -0.57], [50, 140, 0.45], [0, 112, -0.98], [0, 74, -0.51],
    [0, 36, -0.45], [19, 25, 0.01], [53, 16, -0.04], [82, 29, -0.01], [87, 70, -0.14], [70, 100, 0],
    [33, 103, 0.01], [14, 66, 0.07], [50, 60, -0.11],
  ],
  facets: [
    [0, 4, 13], [12, 0, 13], [4, 5, 14], [13, 4, 14], [5, 1, 15], [1, 6, 15], [14, 5, 15], [6, 7, 16],
    [15, 6, 16], [8, 2, 17], [2, 9, 17], [7, 8, 17], [16, 7, 17], [9, 3, 18], [3, 10, 18], [17, 9, 18],
    [10, 11, 18], [11, 12, 19], [12, 13, 19], [18, 11, 19], [14, 15, 20], [15, 16, 20], [13, 14, 20],
    [19, 13, 20], [16, 17, 20], [17, 18, 20], [18, 19, 20],
  ],
};

/** How the light falls on a mesh. */
type Look = {
  /** Height difference → how far a facet leans (the mini mesh has fewer, wider facets, so it needs more). */
  slope: number;
  /** How much a facet's lean changes its brightness. */
  lean: number;
  /** Extra on the facets that face the light squarely: the stone is polished. */
  sheen: number;
  /** A dim second light from the other side, on the facets that turn away — keeps the far side from going dead. */
  back: number;
  /** Strength of the line of light on a ridge. */
  ridge: number;
  /** Width of the edge lines, in mesh units. */
  edgeWidth: number;
};

const BIG_LOOK: Look = { slope: 9, lean: 0.58, sheen: 0.36, back: 0.2, ridge: 1.9, edgeWidth: 0.28 };
const MINI_LOOK: Look = { slope: 22, lean: 0.44, sheen: 0.28, back: 0.2, ridge: 1.1, edgeWidth: 0.9 };

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

const bump = (x: number, y: number, cx: number, cy: number, sx: number, sy: number) =>
  Math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2) / 2);

const smooth = (from: number, to: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - from) / (to - from)));
  return t * t * (3 - 2 * t);
};

/**
 * How bright the surface is at a spot (0…1 across and down the face) before
 * the facets' own lean counts: the plain onyx (0.38 on the scale) in the
 * middle, lighter toward the upper left, where the light comes from — the
 * rim's bright side too —, darker to the right and below the logo, and a
 * little light again at the very tip.
 */
function ambient(x: number, y: number): number {
  return (
    0.385 +
    0.25 * bump(x, y, 0.08, 0.05, 0.36, 0.26) -
    0.1 * x -
    0.1 * smooth(0.42, 0.68, y) +
    0.12 * bump(x, y, 0.5, 0.99, 0.24, 0.1)
  );
}

const n = (k: number) => String(Math.round(k * 10) / 10);
const n2 = (k: number) => String(Math.round(k * 100) / 100).replace(/^0\./, ".");

/**
 * The mesh as a CSS `url("data:…")` picture. `fromRight` paints the same
 * facets with the light on the other side — the big card fades between the
 * two as it is tilted.
 */
function facetPicture(mesh: Mesh, fromRight: boolean, look: Look): string {
  const lightX = fromRight ? 0.7 : -0.7;
  const lightY = -0.7;
  let gradients = "";
  const shapes: { value: number; path: string }[] = [];
  const facets: { leanX: number; leanY: number; value: number }[] = [];
  // Every edge with the facets on its two sides: the edge's two points, and
  // the third corner of the first facet found (tells which side that one is on).
  const edges = new Map<string, { facet: number; p: number; q: number; r: number }[]>();

  mesh.facets.forEach(([a, b, c], i) => {
    const corners = [mesh.points[a], mesh.points[b], mesh.points[c]];
    const cx = (corners[0][0] + corners[1][0] + corners[2][0]) / 3;
    const cy = (corners[0][1] + corners[1][1] + corners[2][1]) / 3;

    // Which way the facet leans (x, y; together at most 1): downhill on the
    // plane through its three corners.
    const ax = corners[1][0] - corners[0][0];
    const ay = corners[1][1] - corners[0][1];
    const az = corners[1][2] - corners[0][2];
    const bx = corners[2][0] - corners[0][0];
    const by = corners[2][1] - corners[0][1];
    const bz = corners[2][2] - corners[0][2];
    const area = ax * by - bx * ay;
    let leanX = (-(az * by - bz * ay) / area) * look.slope;
    let leanY = (-(ax * bz - bx * az) / area) * look.slope;
    const steep = Math.hypot(leanX, leanY);
    if (steep > 1) {
      leanX /= steep;
      leanY /= steep;
    }

    const facing = leanX * lightX + leanY * lightY;
    const across = cx / mesh.w;
    const value =
      ambient(fromRight ? 1 - across : across, cy / mesh.h) +
      look.lean * facing +
      look.sheen * Math.max(0, facing - 0.4) ** 2 * 4 +
      look.back * Math.max(0, -facing - 0.15);
    facets.push({ leanX, leanY, value });

    // Each facet also shades a little across itself, lighter on the side
    // nearer the light — that is what makes it read as polished stone and
    // not as flat grey paper. The flatter the facet, the less.
    const length = Math.hypot(leanX, leanY) || 1;
    const sign = facing >= 0 ? 1 : -1;
    const ux = (leanX / length) * sign;
    const uy = (leanY / length) * sign;
    const along = corners.map(([x, y]) => (x - cx) * ux + (y - cy) * uy);
    const far = Math.min(...along);
    const near = Math.max(...along);
    const within = 0.17 * Math.min(1, 0.35 + steep);
    const from = tone(value - within);
    const to = tone(value + within);
    let fill = `#${from}`;
    if (from !== to) {
      gradients +=
        `<linearGradient id='f${i}' gradientUnits='userSpaceOnUse' ` +
        `x1='${n(cx + ux * far)}' y1='${n(cy + uy * far)}' x2='${n(cx + ux * near)}' y2='${n(cy + uy * near)}'>` +
        `<stop stop-color='#${from}'/><stop offset='1' stop-color='#${to}'/></linearGradient>`;
      fill = `url(#f${i})`;
    }
    // A hair of the facet's own tone around it closes the seams between neighbours.
    const outline = `M${corners.map(([x, y]) => `${n(x)} ${n(y)}`).join("L")}Z`;
    shapes.push({ value, path: `<path d='${outline}' fill='${fill}' stroke='#${tone(value)}'/>` });

    for (const [p, q, r] of [
      [a, b, c],
      [b, c, a],
      [c, a, b],
    ]) {
      const key = p < q ? `${p}-${q}` : `${q}-${p}`;
      const sides = edges.get(key) ?? [];
      sides.push({ facet: i, p, q, r });
      edges.set(key, sides);
    }
  });

  // The edges. Where the surface folds toward the viewer (a ridge) the edge
  // catches a line of light — the sharper the fold and the brighter its lit
  // side, the stronger; ridges in the dark get nothing. Where it folds away
  // (a valley) a thin dark line. No outline anywhere else.
  const lines: { glint: number; path: string }[] = [];
  for (const sides of edges.values()) {
    if (sides.length !== 2) continue;
    const [first, second] = sides;
    const p = mesh.points[first.p];
    const q = mesh.points[first.q];
    const r = mesh.points[first.r];
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    // Across the edge, pointing into the first facet.
    let nx = -(q[1] - p[1]) / length;
    let ny = (q[0] - p[0]) / length;
    if ((r[0] - p[0]) * nx + (r[1] - p[1]) * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    const one = facets[first.facet];
    const other = facets[second.facet];
    // A facet's lean points downhill: a ridge is where both sides go down
    // as they leave the edge.
    const fold = one.leanX * nx + one.leanY * ny - (other.leanX * nx + other.leanY * ny);
    const line = `M${n(p[0])} ${n(p[1])}L${n(q[0])} ${n(q[1])}`;
    if (fold > 0) {
      const glint = Math.min(0.5, 0.02 + look.ridge * fold * Math.max(0, Math.max(one.value, other.value) - 0.5));
      if (glint >= 0.03) lines.push({ glint, path: `<path d='${line}' stroke-opacity='${n2(glint)}'/>` });
    } else {
      const shade = Math.min(0.6, 0.35 * -fold);
      if (shade >= 0.04) lines.push({ glint: -1, path: `<path d='${line}' stroke='#000' stroke-opacity='${n2(shade)}'/>` });
    }
  }

  // Darkest first, so the bright facets and the bright lines end up on top.
  shapes.sort((s, t) => s.value - t.value);
  lines.sort((s, t) => s.glint - t.glint);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${mesh.w} ${mesh.h}' preserveAspectRatio='none'>` +
    `<defs>${gradients}</defs>` +
    `<g stroke-width='.25' stroke-linejoin='round'>${shapes.map((s) => s.path).join("")}</g>` +
    `<g fill='none' stroke='${RIDGE}' stroke-width='${look.edgeWidth}' stroke-linecap='round'>` +
    `${lines.map((l) => l.path).join("")}</g></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23")}")`;
}

/** Facets of the big card, lit from the upper left (the card at rest). */
export const FACETS = "onyx1-facets";
/** The same facets lit from the upper right. */
export const FACETS_TILTED = "onyx1-facets-tilted";
/** Facets of the mini card. */
export const FACETS_MINI = "onyx1-facets-mini";

const FILL = `background-color:${ONYX};background-size:100% 100%;background-repeat:no-repeat`;
const BIG_CSS =
  `.${FACETS},.${FACETS_TILTED}{${FILL}}` +
  `.${FACETS}{background-image:${facetPicture(BIG, false, BIG_LOOK)}}` +
  `.${FACETS_TILTED}{background-image:${facetPicture(BIG, true, BIG_LOOK)}}`;
const MINI_CSS = `.${FACETS_MINI}{${FILL};background-image:${facetPicture(MINI, false, MINI_LOOK)}}`;

/**
 * Puts the facet pictures in the page. React keeps one copy per `href` in
 * <head>, however many cards render this.
 */
export function OnyxFacetStyles({ mini = false }: { mini?: boolean }) {
  return (
    <style href={mini ? "onyx1-facets-mini" : "onyx1-facets-big"} precedence="medium">
      {mini ? MINI_CSS : BIG_CSS}
    </style>
  );
}
