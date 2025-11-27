// File: BracketLineStyles.tsx - Line style generators for knockout bracket connections

export type LineStyle =
  | "smooth-bezier"
  | "rounded-orthogonal"
  | "straight"
  | "elbow"
  | "sharp-orthogonal";

interface LineParams {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  rtl: boolean; // right-to-left direction
}

/**
 * Generate SVG path for smooth Bezier curve (current default)
 */
export function generateSmoothBezier({ x1, y1, x2, y2, rtl }: LineParams): string {
  const dx = Math.max(40, Math.abs(x2 - x1) * 0.35);
  const c1x = rtl ? x1 - dx : x1 + dx;
  const c2x = rtl ? x2 + dx : x2 - dx;
  const c1y = y1;
  const c2y = y2;

  return `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;
}

/**
 * Generate SVG path for rounded orthogonal (tournament bracket style)
 * Creates horizontal → vertical → horizontal path with rounded corners
 */
export function generateRoundedOrthogonal({ x1, y1, x2, y2, rtl }: LineParams): string {
  const radius = 12; // Corner radius for smooth turns
  const midX = (x1 + x2) / 2;

  if (rtl) {
    // Right-to-left: go left, then vertical, then right
    const horizontalDist = Math.abs(x1 - midX);

    if (horizontalDist < radius) {
      // Too close, use straight line
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const path = [
      `M ${x1} ${y1}`,
      `L ${midX + radius} ${y1}`,
    ];

    // Add rounded corner
    if (y2 > y1) {
      // Going down
      path.push(`Q ${midX} ${y1} ${midX} ${y1 + radius}`);
      path.push(`L ${midX} ${y2 - radius}`);
      path.push(`Q ${midX} ${y2} ${midX + radius} ${y2}`);
    } else {
      // Going up
      path.push(`Q ${midX} ${y1} ${midX} ${y1 - radius}`);
      path.push(`L ${midX} ${y2 + radius}`);
      path.push(`Q ${midX} ${y2} ${midX + radius} ${y2}`);
    }

    path.push(`L ${x2} ${y2}`);
    return path.join(' ');
  } else {
    // Left-to-right: go right, then vertical, then right again
    const horizontalDist = Math.abs(midX - x1);

    if (horizontalDist < radius) {
      // Too close, use straight line
      return `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    const path = [
      `M ${x1} ${y1}`,
      `L ${midX - radius} ${y1}`,
    ];

    // Add rounded corner
    if (y2 > y1) {
      // Going down
      path.push(`Q ${midX} ${y1} ${midX} ${y1 + radius}`);
      path.push(`L ${midX} ${y2 - radius}`);
      path.push(`Q ${midX} ${y2} ${midX - radius} ${y2}`);
    } else {
      // Going up
      path.push(`Q ${midX} ${y1} ${midX} ${y1 - radius}`);
      path.push(`L ${midX} ${y2 + radius}`);
      path.push(`Q ${midX} ${y2} ${midX - radius} ${y2}`);
    }

    path.push(`L ${x2} ${y2}`);
    return path.join(' ');
  }
}

/**
 * Generate SVG path for straight line
 */
export function generateStraight({ x1, y1, x2, y2 }: LineParams): string {
  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

/**
 * Generate SVG path for elbow (single 90° turn)
 */
export function generateElbow({ x1, y1, x2, y2, rtl }: LineParams): string {
  const midX = (x1 + x2) / 2;

  if (rtl) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  } else {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
}

/**
 * Generate SVG path for sharp orthogonal (no rounded corners)
 */
export function generateSharpOrthogonal({ x1, y1, x2, y2, rtl }: LineParams): string {
  const midX = (x1 + x2) / 2;

  if (rtl) {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  } else {
    return `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2} ${y2}`;
  }
}

/**
 * Main function to generate path based on style
 */
export function generateLinePath(style: LineStyle, params: LineParams): string {
  switch (style) {
    case "rounded-orthogonal":
      return generateRoundedOrthogonal(params);
    case "straight":
      return generateStraight(params);
    case "elbow":
      return generateElbow(params);
    case "sharp-orthogonal":
      return generateSharpOrthogonal(params);
    case "smooth-bezier":
    default:
      return generateSmoothBezier(params);
  }
}
