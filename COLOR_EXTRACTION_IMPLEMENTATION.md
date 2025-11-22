# Team Logo Color Extraction Implementation

This document describes the implementation of automatic color extraction from team logos.

## Overview

The system automatically extracts the dominant color from team logos and stores it in the `teams.colour` field. This color can be used throughout the application for team branding, UI theming, and visual consistency.

**Client-Side Approach**: Uses browser-native Canvas API for fast, zero-dependency color extraction without server-side processing.

## Features

1. **Automatic Color Extraction**: Colors are automatically extracted when uploading a new logo
2. **Manual Extraction**: Button to manually extract color from existing logos
3. **Color Picker**: Manual color selection via color picker and hex input
4. **Visual Color Display**: Shows extracted color in a preview box with hex value
5. **Smart Algorithm**: Ignores white/black backgrounds and grayscale pixels to find vibrant team colors
6. **Client-Side Processing**: No server dependencies - runs entirely in the browser

## Database Changes

### New Column: `teams.colour`

```sql
-- Run this in your Supabase SQL Editor
ALTER TABLE teams ADD COLUMN IF NOT EXISTS colour TEXT;

-- Add validation constraint for hex color format
ALTER TABLE teams
ADD CONSTRAINT IF NOT EXISTS valid_hex_colour
CHECK (colour IS NULL OR colour ~ '^#[0-9A-Fa-f]{6}$');
```

**Instructions**: Run the SQL script in `add-colour-column.sql` in your Supabase SQL Editor.

## Implementation Details

### 1. TypeScript Types (`src/app/lib/types.ts`)

Added `colour` field to:
- `TeamRow` interface
- `Team` type

### 2. Client-Side Color Extraction (`src/app/lib/colorExtraction.ts`)

Pure client-side utility using browser Canvas API. No server dependencies!

**Functions:**

```typescript
// Extract color from a File object (e.g., from file input)
extractColorFromImageFile(file: File): Promise<string>

// Extract color from an image URL (e.g., existing logo preview)
extractColorFromImageUrl(url: string): Promise<string>
```

**Algorithm:**
1. Creates an in-memory canvas element
2. Resizes image to 100x100 for faster processing
3. Analyzes each pixel's RGB values
4. Filters out:
   - Transparent pixels (alpha < 128)
   - Very bright pixels (brightness > 240) - likely white/background
   - Very dark pixels (brightness < 15) - likely black/shadows
   - Low saturation pixels (saturation < 0.2) - grayscale/neutral
5. Quantizes colors (groups similar colors together)
6. Returns the most common vibrant color as hex

**Benefits of Client-Side Approach:**
- ✅ No server processing required
- ✅ Zero external dependencies
- ✅ Instant results (no network round-trip)
- ✅ Works offline
- ✅ Reduced server load
- ✅ Better privacy (images never leave the browser)

### 3. Team API Endpoints Updates

Updated all team API endpoints to include `colour` field:

- `GET /api/teams` - Lists all teams with colours
- `GET /api/teams/:id` - Get single team with colour
- `POST /api/teams` - Create team with optional colour
- `PATCH /api/teams/:id` - Update team colour
- `DELETE /api/teams/:id` - Soft delete (includes colour in response)

### 4. TeamRowEditor Component (`src/app/dashboard/teams/TeamRowEditor.tsx`)

**New Features:**
- Color input field with visual color picker
- Hex color text input (limited to 7 characters: #RRGGBB)
- "Extract Color" button (appears when editing existing team with logo)
- Automatic color extraction on logo upload
- **Visual Color Display Box**: Shows the current color with:
  - Large color preview square (64x64px)
  - Hex color value in uppercase
  - Previous color comparison (if changed)
  - Confirmation message

**User Workflow:**

1. **When creating a new team:**
   - Upload logo → Color is automatically extracted and displayed
   - Or manually enter/pick a color
   - See live preview of selected color

2. **When editing existing team:**
   - Upload new logo → Color is automatically extracted and saved
   - Or click "Extract Color" button to extract from current logo
   - Or manually change color using picker/input
   - Visual feedback shows current vs. previous color

**Visual Display:**
```
┌────────────────────────────────────────┐
│ [Color Box]  Current Team Colour       │
│              #FF5733                    │
│              Previously: #0080FF        │
└────────────────────────────────────────┘
```

### 5. Dependencies

**Zero external dependencies!**
- Uses native browser Canvas API
- No npm packages required for color extraction
- Works in all modern browsers

## Usage Examples

### Using the Color Extraction Utility

```typescript
import { extractColorFromImageFile, extractColorFromImageUrl } from '@/app/lib/colorExtraction';

// Extract from a file input
async function handleFileUpload(file: File) {
  try {
    const color = await extractColorFromImageFile(file);
    console.log('Extracted color:', color); // e.g., "#ff5733"
  } catch (error) {
    console.error('Color extraction failed:', error);
  }
}

// Extract from an existing image URL
async function extractFromUrl(imageUrl: string) {
  try {
    const color = await extractColorFromImageUrl(imageUrl);
    console.log('Extracted color:', color);
  } catch (error) {
    console.error('Color extraction failed:', error);
  }
}
```

### In TeamRowEditor Component

```typescript
// Automatic extraction on upload
async function actuallyUpload(file: File) {
  // ... upload logic ...
  await extractColorFromLogo(file); // Automatically extracts color client-side
}

// Manual extraction from existing logo
<button onClick={() => extractColorFromLogo()}>
  Extract Color
</button>

// Manual color selection
<input type="color" value={colour} onChange={e => setColour(e.target.value)} />
<input type="text" value={colour} onChange={e => setColour(e.target.value)} maxLength={7} />

// Visual display (automatically shown when colour is set)
{colour && (
  <div className="color-preview">
    <div style={{ backgroundColor: colour }} />
    <div>{colour.toUpperCase()}</div>
  </div>
)}
```

### Using Colors in Your App

```typescript
// Fetch teams with colors
const response = await fetch('/api/teams?sign=1');
const { teams } = await response.json();

// Use team color for styling
teams.forEach(team => {
  console.log(`${team.name}: ${team.colour}`);
  // Example: Use as background color
  // style={{ backgroundColor: team.colour }}
});
```

## Color Extraction Algorithm Details

The algorithm prioritizes **vibrant, saturated colors** that are most likely to represent the team's brand:

### Brightness Calculation
```
brightness = (R * 299 + G * 587 + B * 114) / 1000
```
- Range: 0-255
- Filters: < 15 (too dark) or > 240 (too bright)

### Saturation Calculation
```
saturation = (max(R,G,B) - min(R,G,B)) / max(R,G,B)
```
- Range: 0-1
- Filters: < 0.2 (too grayscale)

### Color Quantization
Colors are grouped into buckets (rounded to nearest 10) to reduce noise:
```
quantized_R = round(R / 10) * 10
```

### RGB to Hex Conversion
```
hex = "#" + R.toString(16) + G.toString(16) + B.toString(16)
```

## Testing

### Manual Testing Steps

1. **Run the database migration:**
   ```bash
   # In Supabase SQL Editor, run:
   # add-colour-column.sql
   ```

2. **Start the dev server:**
   ```bash
   npm run dev
   ```

3. **Test color extraction:**
   - Navigate to Teams admin page
   - Create or edit a team
   - Upload a logo with distinct colors
   - Verify color is automatically extracted
   - Try the "Extract Color" button
   - Manually adjust color using picker

### Test Cases

- ✅ Upload logo with vibrant color (e.g., red logo) → Should extract red
- ✅ Upload logo with white background → Should ignore white, extract actual color
- ✅ Upload logo with multiple colors → Should extract most dominant
- ✅ Click "Extract Color" on existing team → Should update color field
- ✅ Manually select color → Should save to database
- ✅ Create new team with logo → Should auto-extract and save

## Error Handling

The implementation includes graceful error handling:

1. **Image fetch failures**: Returns default blue color (#0080ff)
2. **Invalid image formats**: Caught by sharp library
3. **Missing logo**: User-friendly error message
4. **Database failures**: Errors logged, color still returned to client
5. **Network failures**: Try-catch blocks with user alerts

## Future Enhancements

Potential improvements for the future:

1. **Multiple Color Extraction**: Extract color palette (primary, secondary, tertiary)
2. **Color Contrast Checking**: Ensure text readability over extracted colors
3. **Historical Colors**: Store color history for each team
4. **Bulk Extraction**: Extract colors for all existing teams at once
5. **Color Suggestions**: ML-based color suggestions based on logo
6. **Accessibility**: WCAG compliance checking for color contrasts

## Files Modified

1. `src/app/lib/types.ts` - Added colour field to types
2. `src/app/api/teams/route.ts` - Added colour to GET/POST endpoints
3. `src/app/api/teams/[id]/route.ts` - Added colour to GET/PATCH/DELETE endpoints
4. `src/app/dashboard/teams/TeamRowEditor.tsx` - Added UI, extraction logic, and visual color display
5. `package.json` - No new dependencies (removed sharp)

## Files Created

1. `src/app/lib/colorExtraction.ts` - Client-side color extraction utility
2. `add-colour-column.sql` - Database migration script
3. `COLOR_EXTRACTION_IMPLEMENTATION.md` - This documentation

## Files Removed

1. `src/app/api/teams/extract-color/route.ts` - Server-side API no longer needed

## Maintenance Notes

- **Browser compatibility**: Canvas API is supported in all modern browsers (IE11+)
- **Color validation**: Regex pattern enforces 6-digit hex format (#RRGGBB)
- **CORS**: For extracting from external URLs, ensure CORS headers are properly configured
- **Performance**: Client-side extraction is instant but runs on user's device
- **No caching needed**: Extraction is so fast that caching is unnecessary

## Support

For issues or questions:
1. Check server logs for extraction errors
2. Verify sharp library is installed: `npm list sharp`
3. Confirm database migration was run successfully
4. Test with different image formats (PNG, JPEG, WebP, SVG)
