/**
 * UltraChamp.gr Design System Theme
 *
 * Comprehensive theme definition derived from the website's current styling.
 * This file consolidates all design tokens including colors, typography,
 * spacing, animations, and premium design elements.
 */

export const theme = {
  /**
   * Color Palette
   * Supports both light and dark modes with SRGB and OKLCH color spaces
   */
  colors: {
    light: {
      // Base colors
      background: '#ffffff',
      foreground: '#111827',

      // Surface colors
      card: '#ffffff',
      cardForeground: '#111827',
      popover: '#ffffff',
      popoverForeground: '#111827',

      // Interactive colors
      primary: '#1f2937',
      primaryForeground: '#ffffff',
      secondary: '#f4f4f5',
      secondaryForeground: '#1f2937',

      // Muted/Accent
      muted: '#f4f4f5',
      mutedForeground: '#71717a',
      accent: '#f4f4f5',
      accentForeground: '#1f2937',

      // Semantic colors
      destructive: '#dc2626',

      // Borders & Inputs
      border: '#e4e4e7',
      input: '#e4e4e7',
      ring: '#a1a1aa',

      // Chart colors
      chart: {
        1: '#ea580c', // orange-600
        2: '#0ea5a4', // teal-500
        3: '#4f46e5', // indigo-600
        4: '#eab308', // yellow-500
        5: '#84cc16', // lime-500
      },

      // Sidebar
      sidebar: '#ffffff',
      sidebarForeground: '#111827',
      sidebarPrimary: '#1f2937',
      sidebarPrimaryForeground: '#ffffff',
      sidebarAccent: '#f4f4f5',
      sidebarAccentForeground: '#1f2937',
      sidebarBorder: '#e4e4e7',
      sidebarRing: '#a1a1aa',
    },

    dark: {
      // Base colors
      background: '#0f1115',
      foreground: '#fafafa',

      // Surface colors
      card: '#1f2937',
      cardForeground: '#fafafa',
      popover: '#1f2937',
      popoverForeground: '#fafafa',

      // Interactive colors
      primary: '#e5e7eb',
      primaryForeground: '#111827',
      secondary: '#1f2937',
      secondaryForeground: '#fafafa',

      // Muted/Accent
      muted: '#1f2937',
      mutedForeground: '#a1a1aa',
      accent: '#1f2937',
      accentForeground: '#fafafa',

      // Semantic colors
      destructive: '#ef4444',

      // Borders & Inputs
      border: '#27272a',
      input: '#2a2a2e',
      ring: '#a1a1aa',

      // Chart colors
      chart: {
        1: '#60a5fa', // blue-400
        2: '#34d399', // emerald-400
        3: '#eab308', // yellow-500
        4: '#a78bfa', // violet-400
        5: '#f97316', // orange-500
      },

      // Sidebar
      sidebar: '#1f2937',
      sidebarForeground: '#fafafa',
      sidebarPrimary: '#60a5fa',
      sidebarPrimaryForeground: '#0b0b0c',
      sidebarAccent: '#111827',
      sidebarAccentForeground: '#fafafa',
      sidebarBorder: '#27272a',
      sidebarRing: '#a1a1aa',
    },

    /**
     * Premium Design Colors
     * Special color schemes for premium components
     */
    premium: {
      // Red-Gold Prestige theme (used in player cards)
      gold: {
        primary: '#D4AF37',
        primaryDark: '#8C6C00',
        accent: '#FFC107',
        accentLight: '#FFE08A',
        glow: 'rgba(212, 175, 55, 0.4)',
      },

      // Crimson Kintsugi (navbar theme)
      crimson: {
        base: '#0b0606',
        secondary: '#160808',
        goldUnderline: {
          start: '#f5d37a',
          mid: '#d9a94f',
          end: '#f5d37a',
        },
      },

      // Sunpillar gradients (holographic effects)
      sunpillar: [
        'hsl(45, 100%, 72%)',
        'hsl(42, 95%, 70%)',
        'hsl(48, 100%, 74%)',
        'hsl(52, 100%, 80%)',
        'hsl(38, 90%, 60%)',
        'hsl(55, 95%, 76%)',
      ],

      // Match carousel
      carousel: {
        arrow: 'rgb(249, 115, 22)', // orange-500
        arrowGlow: 'rgba(249, 115, 22, 0.3)',
      },

      // FullCalendar
      calendar: {
        text: '#ffffff',
        muted: 'rgba(255, 255, 255, 0.70)',
        bg: '#0c0d10',
        surface: '#111317',
        border: 'rgba(255, 255, 255, 0.09)',
        accent: '#22c55e', // green
        accent2: '#60a5fa', // blue
        danger: '#ef4444', // red
        warning: '#eab308', // yellow
      },
    },

    /**
     * Background Utilities
     */
    backgrounds: {
      dotGrid: {
        light: {
          bg: '#fafafa', // zinc-50
          dot: 'rgba(0, 0, 0, 0.06)',
        },
        dark: {
          bg: '#09090b', // zinc-950
          dot: 'rgba(255, 255, 255, 0.06)',
        },
      },
    },
  },

  /**
   * Typography
   * Font families and text styling
   */
  typography: {
    fonts: {
      // Default body font
      sans: ['var(--font-roboto-condensed)', 'ui-sans-serif', 'system-ui', 'sans-serif'],

      // Sporty headline fonts
      exo2: ['var(--font-exo2)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      ubuntuCondensed: ['var(--font-ubuntu-condensed)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      notoSans: ['var(--font-noto-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
    },

    // Font weights used throughout the site
    weights: {
      light: 300,
      normal: 400,
      bold: 700,
      extraBold: 800,
      black: 900,
    },
  },

  /**
   * Spacing & Sizing
   */
  spacing: {
    // Border radius
    radius: {
      default: '0.625rem', // 10px
      sm: 'calc(0.625rem - 4px)',
      md: 'calc(0.625rem - 2px)',
      lg: '0.625rem',
      xl: 'calc(0.625rem + 4px)',
      card: '30px', // Premium card radius
    },

    // Dot grid cell spacing (responsive)
    dotGridCell: {
      base: '18px',
      tablet: '20px',
      desktop: '22px',
    },

    // Navbar heights
    navbar: {
      mobile: '64px',
      desktop: '128px',
    },
  },

  /**
   * Animations
   */
  animations: {
    // Animation durations
    durations: {
      fast: '0.2s',
      normal: '0.35s',
      medium: '0.5s',
      slow: '0.6s',
      fadeIn: '0.5s',
      fadeUp: '700ms',
      linkUnderline: '0.35s',
    },

    // Easing functions
    easing: {
      easeOut: 'ease-out',
      easeInOut: 'ease-in-out',
      linear: 'linear',
    },

    // Named animations
    keyframes: {
      fadeIn: {
        from: { opacity: '0' },
        to: { opacity: '1' },
      },
      fadeUp: {
        '0%': { opacity: 0, transform: 'translateY(12px) scale(0.98)' },
        '100%': { opacity: 1, transform: 'translateY(0) scale(1)' },
      },
      kintsugiPan: {
        duration: '24s',
        timing: 'ease-in-out',
        iterations: 'infinite',
      },
      navFadeOut: {
        from: { opacity: 1, transform: 'translateY(0)' },
        to: { opacity: 0, transform: 'translateY(-12px)' },
      },
      marquee: {
        duration: '8s',
        timing: 'linear',
      },
      metallicShine: {
        duration: '3s',
        timing: 'ease-in-out',
        iterations: 'infinite',
      },
      holoBg: {
        duration: '18s',
        timing: 'linear',
        iterations: 'infinite',
      },
      meshGradient: {
        duration: '20s',
        timing: 'ease-in-out',
        iterations: 'infinite',
      },
    },
  },

  /**
   * Effects & Filters
   */
  effects: {
    // Shadows
    shadows: {
      card: '0 8px 32px rgba(0, 0, 0, 0.5)',
      premium: '0 0 40px rgba(212, 175, 55, 0.1)',
      carouselArrow: '0 4px 12px rgba(249, 115, 22, 0.3)',
      carouselArrowHover: '0 6px 16px rgba(249, 115, 22, 0.5)',
    },

    // Backdrop filters
    blur: {
      light: 'blur(8px)',
      medium: 'blur(10px)',
      heavy: 'blur(20px)',
    },

    // Mix blend modes
    blendModes: {
      overlay: 'overlay',
      colorDodge: 'color-dodge',
      multiply: 'multiply',
      luminosity: 'luminosity',
      difference: 'difference',
      screen: 'screen',
      softLight: 'soft-light',
    },

    // Grain/texture opacity
    textures: {
      grain: 0.22,
      carbonFiber: 0.18,
      leather: 0.12,
    },
  },

  /**
   * Breakpoints
   * Responsive design breakpoints
   */
  breakpoints: {
    mobile: '480px',
    tablet: '640px',
    desktop: '1024px',
    wide: '1280px',
  },

  /**
   * Component-specific themes
   */
  components: {
    // Player card theme
    playerCard: {
      aspectRatio: 0.718,
      height: {
        desktop: '80svh',
        tablet: '75svh',
        mobile: '70svh',
        small: '65svh',
      },
      maxHeight: {
        desktop: 'none',
        tablet: '650px',
        mobile: '600px',
        small: '550px',
      },
    },

    // Button/Interactive states
    interactive: {
      transition: 'all 0.2s ease',
      hoverScale: 1.1,
      activeScale: 0.98,
    },
  },

  /**
   * Z-Index Scale
   * Consistent layering system
   */
  zIndex: {
    base: 0,
    texture: 1,
    leather: 2,
    shine: 3,
    glare: 4,
    content: 5,
    panel: 10,
    header: 15,
    navbar: 50,
    modal: 100,
  },
} as const;

/**
 * Type exports for TypeScript usage
 */
export type Theme = typeof theme;
export type ColorMode = 'light' | 'dark';
export type ThemeColors = typeof theme.colors.light | typeof theme.colors.dark;

/**
 * Helper function to get theme color by path
 */
export function getThemeColor(
  mode: ColorMode,
  path: string
): string | undefined {
  const keys = path.split('.');
  let value: any = theme.colors[mode];

  for (const key of keys) {
    if (value && typeof value === 'object') {
      value = value[key];
    } else {
      return undefined;
    }
  }

  return typeof value === 'string' ? value : undefined;
}

/**
 * CSS Variable mapping
 * Maps theme values to CSS custom properties
 */
export const cssVariables = {
  light: {
    '--background': theme.colors.light.background,
    '--foreground': theme.colors.light.foreground,
    '--card': theme.colors.light.card,
    '--card-foreground': theme.colors.light.cardForeground,
    '--popover': theme.colors.light.popover,
    '--popover-foreground': theme.colors.light.popoverForeground,
    '--primary': theme.colors.light.primary,
    '--primary-foreground': theme.colors.light.primaryForeground,
    '--secondary': theme.colors.light.secondary,
    '--secondary-foreground': theme.colors.light.secondaryForeground,
    '--muted': theme.colors.light.muted,
    '--muted-foreground': theme.colors.light.mutedForeground,
    '--accent': theme.colors.light.accent,
    '--accent-foreground': theme.colors.light.accentForeground,
    '--destructive': theme.colors.light.destructive,
    '--border': theme.colors.light.border,
    '--input': theme.colors.light.input,
    '--ring': theme.colors.light.ring,
    '--radius': theme.spacing.radius.default,
  },
  dark: {
    '--background': theme.colors.dark.background,
    '--foreground': theme.colors.dark.foreground,
    '--card': theme.colors.dark.card,
    '--card-foreground': theme.colors.dark.cardForeground,
    '--popover': theme.colors.dark.popover,
    '--popover-foreground': theme.colors.dark.popoverForeground,
    '--primary': theme.colors.dark.primary,
    '--primary-foreground': theme.colors.dark.primaryForeground,
    '--secondary': theme.colors.dark.secondary,
    '--secondary-foreground': theme.colors.dark.secondaryForeground,
    '--muted': theme.colors.dark.muted,
    '--muted-foreground': theme.colors.dark.mutedForeground,
    '--accent': theme.colors.dark.accent,
    '--accent-foreground': theme.colors.dark.accentForeground,
    '--destructive': theme.colors.dark.destructive,
    '--border': theme.colors.dark.border,
    '--input': theme.colors.dark.input,
    '--ring': theme.colors.dark.ring,
    '--radius': theme.spacing.radius.default,
  },
} as const;

export default theme;
