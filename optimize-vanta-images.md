# Vanta Background Image Optimization Guide

## Online Tools (Easiest - No Installation)

### Option 1: TinyPNG (Recommended)
1. Go to https://tinypng.com/
2. Upload your screenshot
3. Download optimized version
4. **Expect 60-80% size reduction** with minimal quality loss

### Option 2: Squoosh (Google - More Control)
1. Go to https://squoosh.app/
2. Upload screenshot
3. Settings:
   - Format: **WebP** (best) or **JPEG** (better compatibility)
   - Quality: **75-85** (sweet spot)
   - Resize: If captured at 4K, resize to 2560px width for desktop
4. Compare before/after
5. Download

## CLI Tools (If you have them installed)

### Using ImageMagick:
```bash
# Convert to WebP with 85% quality
magick screenshot.png -quality 85 vanta-bg-desktop.webp

# Create responsive variants
magick screenshot.png -resize 2560x vanta-bg-desktop.webp
magick screenshot.png -resize 1024x vanta-bg-tablet.webp
magick screenshot.png -resize 768x vanta-bg-mobile.webp
```

### Using Sharp (Node.js):
```bash
npm install -g sharp-cli

# Optimize and resize
sharp -i screenshot.png -o vanta-bg-desktop.webp --webp-quality 85 --resize 2560
```

## Recommended File Sizes After Optimization

| Variant | Dimensions | Target File Size |
|---------|-----------|------------------|
| Desktop | 2560×1440 | < 150 KB (WebP) or < 300 KB (JPEG) |
| Tablet  | 1024×768  | < 80 KB (WebP) or < 150 KB (JPEG) |
| Mobile  | 768×1024  | < 60 KB (WebP) or < 120 KB (JPEG) |

## Format Recommendations

1. **WebP** (best choice):
   - Smaller file size (30% smaller than JPEG)
   - Excellent browser support (96%+)
   - Use with JPEG fallback for old browsers

2. **JPEG** (fallback):
   - Universal support
   - Quality: 75-85%
   - Slightly larger files

3. **AVIF** (future-proof):
   - Even smaller than WebP
   - Growing browser support
   - Use as progressive enhancement

## Final Files Structure

```
public/images/vanta/
├── vanta-bg-desktop.webp      (2560×1440, ~120 KB)
├── vanta-bg-desktop.jpg       (fallback, ~250 KB)
├── vanta-bg-tablet.webp       (1024×768, ~70 KB)
├── vanta-bg-tablet.jpg        (fallback, ~140 KB)
├── vanta-bg-mobile.webp       (768×1024, ~50 KB)
└── vanta-bg-mobile.jpg        (fallback, ~100 KB)
```

## Quality Check

Before finalizing:
- ✅ No visible compression artifacts
- ✅ Colors match original (golden yellow + brownish-red)
- ✅ File size < 150 KB for desktop WebP
- ✅ Looks good on both light and dark UI elements
- ✅ 20% black overlay still applied (or bake it into the image)
