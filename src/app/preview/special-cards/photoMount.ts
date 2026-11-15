// The frame the special cards keep around a photo: one shape for all of them.
//
// Without a photo, the upper zone of a big special card is covered by the
// edition's own facets. With a photo, the photo takes the zone and only a few
// facets stay at its corners, like the corner mounts of a photo in an album.
// Those few facets are the ones in this file. Every edition paints these same
// shapes, each in its own colours, so the frame is the same on every card —
// change it here and all of them follow.
//
// Only the left side is written down. The right side is the left side
// mirrored (`mirrored`), so the two sides of a photo always match.
//
// The shapes are the left corner facets of the «Θρύλος» cut
// (legend/v1/legendFinish.tsx), in the same 100 × 76 box as every edition's
// facets. Plain data and strings, no React.

export type MountMesh = {
  w: number;
  h: number;
  points: readonly (readonly [number, number])[];
  /** Three point indices, then which way the facet leans (x, y; each -1…1). */
  facets: readonly (readonly [number, number, number, number, number])[];
};

/** The left side of the frame, in the form the editions' own facets have. */
export const MOUNT: MountMesh = {
  w: 100,
  h: 76,
  points: [
    [0, 0], [27.5, 0], [11.4, 18.6], [0, 15.3], [0, 35.5],
    [0, 76], [20.1, 76], [14.6, 69.6], [7.2, 60.2], [17.5, 46.3], [0, 54.5],
  ],
  facets: [
    // Upper corner: two whole facets, then one etched under them.
    [1, 2, 0, -0.37, 0.62], [2, 3, 0, -0.28, 0.46], [3, 2, 4, 0.06, 0.36],
    // Lower corner: three whole facets, then two etched above them.
    [7, 6, 5, 0.72, 0.41], [10, 8, 5, 0.07, 0.62], [8, 7, 5, -0.18, -0.68], [8, 9, 7, 0.54, 0.2], [8, 10, 9, 0.7, 0.18],
  ],
};

/**
 * The facets of `MOUNT` of which only the edge lines show, with a breath of
 * colour — as if etched on the photo. The others are whole, solid facets.
 */
const ETCHED: readonly number[] = [2, 6, 7];

/** Width of the facets' edge lines on a big card, in the box's units. */
export const MOUNT_EDGE = 0.3;

/**
 * `content` once more, flipped left to right across the middle of the box.
 * Colours and shading flip with it, so the copy is a true mirror image.
 */
export const mirrored = (content: string) => `<g transform='matrix(-1 0 0 1 ${MOUNT.w} 0)'>${content}</g>`;

const n = (k: number) => String(Math.round(k * 10) / 10);

/**
 * The frame as a CSS mask picture (`url("data:…")`) for the upper zone: the
 * whole facets stay, the etched ones stay as lines, everything else is cut
 * away — so the middle of the zone, top to bottom, where the face is, is the
 * photo alone. Both sides are in it.
 */
export const MOUNT_MASK: string = (() => {
  const shapes = MOUNT.facets
    .map(([a, b, c], i) => {
      const d = [a, b, c].map((k) => `${n(MOUNT.points[k][0])} ${n(MOUNT.points[k][1])}`).join("L");
      return `<path d='M${d}Z'${ETCHED.includes(i) ? " fill-opacity='.14' stroke-opacity='.8'" : ""}/>`;
    })
    .join("");
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${MOUNT.w} ${MOUNT.h}' preserveAspectRatio='none'>` +
    `<g stroke='#000' stroke-width='${MOUNT_EDGE}' stroke-linejoin='round'>${shapes}${mirrored(shapes)}</g></svg>`;
  return `url("data:image/svg+xml,${svg.replace(/#/g, "%23")}")`;
})();
