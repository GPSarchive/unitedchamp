# UltraChamp.gr Design System

This directory contains the complete design system theme derived from the UltraChamp.gr website.

## Overview

The theme is a comprehensive collection of design tokens including:

- **Colors**: Light/dark mode color palettes with SRGB and OKLCH support
- **Typography**: Font families and weights
- **Spacing**: Border radius, padding, and layout measurements
- **Animations**: Keyframes, durations, and easing functions
- **Effects**: Shadows, blur filters, blend modes, and textures
- **Components**: Component-specific theming
- **Breakpoints**: Responsive design breakpoints

## Usage

### Basic Import

```typescript
import theme from '@/theme';

// Access theme values
const primaryColor = theme.colors.light.primary;
const cardRadius = theme.spacing.radius.card;
const fadeInDuration = theme.animations.durations.fadeIn;
```

### Get Theme Color Helper

```typescript
import { getThemeColor } from '@/theme';

// Get color by path
const chartColor = getThemeColor('light', 'chart.1'); // Returns '#ea580c'
```

### CSS Variables

```typescript
import { cssVariables } from '@/theme';

// Apply CSS variables programmatically
Object.entries(cssVariables.light).forEach(([key, value]) => {
  document.documentElement.style.setProperty(key, value);
});
```

## Theme Structure

### Colors

#### Light Mode
- Clean, professional white backgrounds
- Dark gray (#111827) text
- Neutral grays for secondary elements
- Vibrant chart colors (orange, teal, indigo, yellow, lime)

#### Dark Mode
- Deep dark background (#0f1115)
- Near-white text (#fafafa)
- Gray-800 surfaces
- Softer chart colors optimized for dark backgrounds

#### Premium Colors
Special color schemes for premium components:

- **Gold Theme**: Red-gold prestige palette used in player cards
  - Primary Gold: #D4AF37
  - Accent: #FFC107
  - Creates luxury, premium feel

- **Crimson Kintsugi**: Deep crimson navbar theme
  - Base: #0b0606
  - Animated gold underlines
  - Subtle radial warmth effects

### Typography

Four main font families:

1. **Roboto Condensed** (default): Body text, general UI
2. **Exo 2**: Sporty headlines and hero text
3. **Ubuntu Condensed**: Alternative headlines
4. **Noto Sans**: Greek language support, alternative sans-serif

All fonts support Greek character sets for Greek language content.

### Animations

#### Named Animations

- **fadeIn**: Smooth opacity fade (0.5s)
- **fadeUp**: Entrance animation with slight lift (700ms)
- **kintsugiPan**: Slow animated gradient drift for navbar (24s)
- **metallicShine**: Metallic text shimmer effect (3s)
- **holoBg**: Holographic background animation (18s)
- **marquee**: Scrolling text effect (8s)

#### Usage in Components

```tsx
// Using theme animations
const StyledDiv = styled.div`
  animation: fadeIn ${theme.animations.durations.fadeIn} ${theme.animations.easing.easeOut};
`;
```

### Effects

#### Shadows

- **card**: Elevated card shadow
- **premium**: Subtle gold glow for premium elements
- **carouselArrow**: Orange glow for match carousel

#### Textures

Premium texture effects:

- **Grain**: Fine film grain (22% opacity)
- **Carbon Fiber**: Woven pattern (18% opacity)
- **Leather**: Organic texture (12% opacity)

### Breakpoints

```typescript
// Mobile-first responsive design
theme.breakpoints = {
  mobile: '480px',   // Small phones
  tablet: '640px',   // Tablets, large phones
  desktop: '1024px', // Desktop screens
  wide: '1280px',    // Wide displays
}
```

### Component Themes

#### Player Card

```typescript
theme.components.playerCard = {
  aspectRatio: 0.718,  // Trading card proportions
  height: {
    desktop: '80svh',
    tablet: '75svh',
    mobile: '70svh',
    small: '65svh',
  },
  // ... responsive max heights
}
```

### Z-Index Scale

Consistent layering system prevents z-index conflicts:

```typescript
theme.zIndex = {
  base: 0,       // Default layer
  texture: 1,    // Texture overlays
  shine: 3,      // Shine effects
  content: 5,    // Main content
  panel: 10,     // Floating panels
  header: 15,    // Headers
  navbar: 50,    // Navigation
  modal: 100,    // Modals/dialogs
}
```

## Design Principles

### Sports-Focused Aesthetic

The theme embodies a modern sports platform with:

- **Bold Typography**: Condensed fonts for compact, impactful headlines
- **Dynamic Animations**: Smooth, energetic transitions
- **Premium Materials**: Gold accents, metallic textures, luxury finishes
- **Data Visualization**: Vibrant, accessible chart colors

### Dark Mode First

While supporting both modes, the design shines in dark mode:

- Deep blacks with subtle warmth
- High contrast for readability
- Glowing accents and premium effects
- Optimized for extended viewing

### Greek Language Support

All fonts include comprehensive Greek character sets:

- Proper rendering of Greek text
- Consistent weight and spacing
- Optimized for bilingual content

## Premium Components

### Crimson Kintsugi Navbar

Signature navbar design featuring:

- Deep crimson base with animated radial gradients
- Fine grain texture overlay
- Gold animated underlines on links
- Blur and depth effects
- 24-second slow drift animation

### Player Cards

3D holographic trading cards with:

- Red-gold prestige color scheme
- Carbon fiber and leather textures
- Metallic shimmer animations
- Perspective transforms
- Sunpillar gradients (golden rays)
- Team logo displays

### Match Carousel

Interactive match browsing with:

- Orange-500 navigation arrows
- Glow effects on hover
- Responsive sizing
- External arrow positioning

## File Structure

```
src/theme/
├── index.ts         # Main theme export
├── README.md        # This file
└── utilities.ts     # Theme helper functions (future)
```

## Extending the Theme

To add new theme values:

1. Update the theme object in `index.ts`
2. Add TypeScript types if needed
3. Update CSS variables mapping if applicable
4. Document the new values in this README

## Migration from CSS Variables

The current implementation uses CSS custom properties in `globals.css`. This theme file:

- **Preserves** all existing CSS variables
- **Adds** TypeScript type safety
- **Enables** programmatic theme access
- **Supports** theme switching and customization

You can gradually migrate components to use this theme object while maintaining backward compatibility with CSS variables.

## Related Files

- `/src/app/globals.css` - Global styles and CSS variable definitions
- `/src/app/layout.tsx` - Font configuration and root layout
- `/tailwind.config.js` - Tailwind CSS configuration
- `/components.json` - shadcn/ui configuration

## Color Accessibility

All color combinations meet WCAG 2.1 accessibility standards:

- AA contrast for body text (4.5:1 minimum)
- AAA contrast for large text (7:1 minimum)
- Semantic colors for destructive actions
- High contrast mode compatible

## Performance

Theme optimizations:

- CSS variables for runtime switching
- Hardware-accelerated animations
- Reduced motion support (@prefers-reduced-motion)
- Efficient gradient rendering
- Optimized texture patterns
