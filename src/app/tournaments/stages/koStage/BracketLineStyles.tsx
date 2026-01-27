// File: BracketLineStyles.tsx — Smooth bezier curve connections for knockout bracket

interface LineParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate SVG path for a smooth S-curve connection between bracket nodes.
 * Uses cubic bezier with horizontal control points for a clean, sporty look.
 */
export function generateElbowPath({ x1, y1, x2, y2 }: LineParams): string {
  const dx = Math.abs(x2 - x1);
  const tension = dx * 0.45; // how far the control points extend horizontally
  const cx1 = x1 + (x2 > x1 ? tension : -tension);
  const cx2 = x2 + (x2 > x1 ? -tension : tension);
  return `M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`;
}
