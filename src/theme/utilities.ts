/**
 * Utility functions for theme manipulation and CSS generation
 */

import theme, { ColorMode, cssVariables } from './index';

/**
 * Generates CSS variable declarations from theme
 */
export function generateCSSVariables(mode: ColorMode = 'light'): string {
  const vars = cssVariables[mode];

  return Object.entries(vars)
    .map(([key, value]) => `${key}: ${value};`)
    .join('\n  ');
}

/**
 * Applies theme CSS variables to the document root
 */
export function applyThemeToDocument(mode: ColorMode = 'light'): void {
  if (typeof document === 'undefined') return;

  const vars = cssVariables[mode];
  const root = document.documentElement;

  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
}

/**
 * Converts hex color to RGBA
 */
export function hexToRGBA(hex: string, alpha: number = 1): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Creates a gradient string from theme colors
 */
export function createGradient(
  direction: string,
  colors: string[]
): string {
  return `linear-gradient(${direction}, ${colors.join(', ')})`;
}

/**
 * Gets responsive value based on viewport width
 */
export function getResponsiveValue<T>(values: {
  mobile?: T;
  tablet?: T;
  desktop?: T;
  wide?: T;
}): T | undefined {
  if (typeof window === 'undefined') return values.mobile;

  const width = window.innerWidth;

  if (width >= parseInt(theme.breakpoints.wide)) {
    return values.wide ?? values.desktop ?? values.tablet ?? values.mobile;
  }
  if (width >= parseInt(theme.breakpoints.desktop)) {
    return values.desktop ?? values.tablet ?? values.mobile;
  }
  if (width >= parseInt(theme.breakpoints.tablet)) {
    return values.tablet ?? values.mobile;
  }

  return values.mobile;
}

/**
 * Creates box shadow with theme values
 */
export function createShadow(
  offsetX: number,
  offsetY: number,
  blur: number,
  spread: number,
  color: string
): string {
  return `${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
}

/**
 * Generates media query string from breakpoint
 */
export function mediaQuery(breakpoint: keyof typeof theme.breakpoints): string {
  return `@media (min-width: ${theme.breakpoints[breakpoint]})`;
}

/**
 * Combines multiple CSS filters
 */
export function combineFilters(...filters: string[]): string {
  return filters.filter(Boolean).join(' ');
}

/**
 * Creates animation shorthand
 */
export function createAnimation(
  name: string,
  duration: string,
  timing: string = 'ease',
  iterations: string | number = 1,
  direction: string = 'normal'
): string {
  return `${name} ${duration} ${timing} ${iterations} ${direction}`;
}

/**
 * Generates backdrop filter blur
 */
export function backdropBlur(amount: keyof typeof theme.effects.blur): string {
  return theme.effects.blur[amount];
}

/**
 * Creates CSS transform string
 */
export function createTransform(transforms: {
  translateX?: string;
  translateY?: string;
  translateZ?: string;
  scale?: number;
  scaleX?: number;
  scaleY?: number;
  rotate?: string;
  rotateX?: string;
  rotateY?: string;
  skew?: string;
}): string {
  const parts: string[] = [];

  if (transforms.translateX || transforms.translateY || transforms.translateZ) {
    const x = transforms.translateX ?? '0';
    const y = transforms.translateY ?? '0';
    const z = transforms.translateZ ?? '0';
    parts.push(`translate3d(${x}, ${y}, ${z})`);
  }
  if (transforms.scale !== undefined) parts.push(`scale(${transforms.scale})`);
  if (transforms.scaleX !== undefined) parts.push(`scaleX(${transforms.scaleX})`);
  if (transforms.scaleY !== undefined) parts.push(`scaleY(${transforms.scaleY})`);
  if (transforms.rotate) parts.push(`rotate(${transforms.rotate})`);
  if (transforms.rotateX) parts.push(`rotateX(${transforms.rotateX})`);
  if (transforms.rotateY) parts.push(`rotateY(${transforms.rotateY})`);
  if (transforms.skew) parts.push(`skew(${transforms.skew})`);

  return parts.join(' ');
}

/**
 * Gets chart color by index
 */
export function getChartColor(mode: ColorMode, index: number): string {
  const chartColors = theme.colors[mode].chart;
  const colorKeys = Object.keys(chartColors) as Array<keyof typeof chartColors>;
  const key = colorKeys[index % colorKeys.length];
  return chartColors[key];
}

/**
 * Creates radial gradient
 */
export function createRadialGradient(
  shape: 'circle' | 'ellipse',
  position: string,
  colors: string[]
): string {
  return `radial-gradient(${shape} at ${position}, ${colors.join(', ')})`;
}

/**
 * Applies opacity to color
 */
export function withOpacity(color: string, opacity: number): string {
  if (color.startsWith('#')) {
    return hexToRGBA(color, opacity);
  }
  if (color.startsWith('rgb(')) {
    return color.replace('rgb(', 'rgba(').replace(')', `, ${opacity})`);
  }
  return color;
}

/**
 * Gets font family string
 */
export function getFontFamily(
  family: keyof typeof theme.typography.fonts
): string {
  return theme.typography.fonts[family].join(', ');
}

/**
 * Creates text shadow with glow effect
 */
export function createTextGlow(color: string, blur: number = 10): string {
  return `0 0 ${blur}px ${color}`;
}

/**
 * Gets component-specific theme
 */
export function getComponentTheme<K extends keyof typeof theme.components>(
  component: K
): typeof theme.components[K] {
  return theme.components[component];
}

/**
 * Checks if color is dark
 */
export function isColorDark(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Calculate relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.5;
}

/**
 * Creates CSS custom property reference
 */
export function cssVar(name: string, fallback?: string): string {
  return fallback ? `var(${name}, ${fallback})` : `var(${name})`;
}
