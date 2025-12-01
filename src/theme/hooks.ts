/**
 * React hooks for theme usage
 * Provides convenient access to theme values in React components
 */

import { useMemo } from 'react';
import theme, { ColorMode, getThemeColor } from './index';

/**
 * Hook to get theme values with type safety
 */
export function useTheme() {
  return useMemo(() => theme, []);
}

/**
 * Hook to get a specific color from the theme
 * @param mode - Color mode ('light' | 'dark')
 * @param path - Dot-notation path to color (e.g., 'chart.1')
 */
export function useThemeColor(mode: ColorMode, path: string) {
  return useMemo(() => getThemeColor(mode, path), [mode, path]);
}

/**
 * Hook to get responsive breakpoint values
 * Returns true if viewport matches or exceeds the breakpoint
 */
export function useBreakpoint(breakpoint: keyof typeof theme.breakpoints) {
  if (typeof window === 'undefined') return false;

  const breakpointValue = parseInt(theme.breakpoints[breakpoint]);

  // Convert to useMemo for performance
  return useMemo(() => {
    return window.matchMedia(`(min-width: ${breakpointValue}px)`).matches;
  }, [breakpointValue]);
}

/**
 * Hook to apply theme-based animations
 */
export function useThemeAnimation(animationName: string) {
  const animations = useTheme().animations;

  return useMemo(() => {
    return {
      animation: animationName,
      durations: animations.durations,
      easing: animations.easing,
    };
  }, [animationName, animations]);
}

/**
 * Hook to get premium color palette
 */
export function usePremiumColors(palette: 'gold' | 'crimson' | 'carousel' | 'calendar') {
  const premiumColors = useTheme().colors.premium;

  return useMemo(() => {
    return premiumColors[palette];
  }, [palette, premiumColors]);
}

/**
 * Hook to check if reduced motion is preferred
 */
export function usePrefersReducedMotion() {
  if (typeof window === 'undefined') return false;

  return useMemo(() => {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
}

/**
 * Hook to get z-index value from the scale
 */
export function useZIndex(layer: keyof typeof theme.zIndex) {
  const zIndexScale = useTheme().zIndex;

  return useMemo(() => {
    return zIndexScale[layer];
  }, [layer, zIndexScale]);
}
