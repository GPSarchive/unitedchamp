// File: BracketLineStyles.tsx - Elbow line style for knockout bracket connections

interface LineParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/**
 * Generate SVG path for elbow (single 90° turn)
 * Creates clean L-shaped connections between nodes
 */
export function generateElbowPath({ x1, y1, x2, y2 }: LineParams): string {
  const midX = (x1 + x2) / 2;
  return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
}
