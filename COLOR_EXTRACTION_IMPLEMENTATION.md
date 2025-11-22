# Team Logo Color Extraction Implementation

This document describes the implementation of automatic color extraction from team logos.

## Overview

The system automatically extracts the dominant color from team logos and stores it in the `teams.colour` field. This color can be used throughout the application for team branding, UI theming, and visual consistency.

## Features

1. **Automatic Color Extraction**: Colors are automatically extracted when uploading a new logo
2. **Manual Extraction**: Button to manually extract color from existing logos
3. **Color Picker**: Manual color selection via color picker and hex input
4. **Smart Algorithm**: Ignores white/black backgrounds and grayscale pixels to find vibrant team colors

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

### 2. Color Extraction API (`src/app/api/teams/extract-color/route.ts`)

New endpoint: `POST /api/teams/extract-color`

**Request formats:**

```typescript
// Extract from uploaded file
const formData = new FormData();
formData.append('file', imageFile);
fetch('/api/teams/extract-color', { method: 'POST', body: formData });

// Extract from existing team logo
fetch('/api/teams/extract-color', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ teamId: 123 })
});
```

**Response:**
```json
{
  "colour": "#0080ff"
}
```

**Algorithm:**
1. Resizes image to 100x100 for faster processing
2. Analyzes each pixel's RGB values
3. Filters out:
   - Transparent pixels (alpha < 128)
   - Very bright pixels (brightness > 240) - likely white/background
   - Very dark pixels (brightness < 15) - likely black/shadows
   - Low saturation pixels (saturation < 0.2) - grayscale/neutral
4. Quantizes colors (groups similar colors together)
5. Returns the most common vibrant color as hex

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
- Hex color text input
- "Extract Color" button (appears when editing existing team with logo)
- Automatic color extraction on logo upload

**User Workflow:**

1. **When creating a new team:**
   - Upload logo → Color is automatically extracted
   - Or manually enter/pick a color

2. **When editing existing team:**
   - Upload new logo → Color is automatically extracted
   - Or click "Extract Color" button to extract from current logo
   - Or manually change color using picker/input

### 5. Dependencies

**New packages installed:**
- `sharp` - Fast image processing library (used for color extraction)
- `@types/sharp` - TypeScript definitions for sharp

## Usage Examples

### In TeamRowEditor Component

```typescript
// Automatic extraction on upload
async function actuallyUpload(file: File) {
  // ... upload logic ...
  await extractColorFromLogo(file); // Automatically extracts color
}

// Manual extraction from existing logo
<button onClick={() => extractColorFromLogo()}>
  Extract Color
</button>

// Manual color selection
<input type="color" value={colour} onChange={e => setColour(e.target.value)} />
<input type="text" value={colour} onChange={e => setColour(e.target.value)} />
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
4. `src/app/dashboard/teams/TeamRowEditor.tsx` - Added UI and extraction logic
5. `package.json` - Added sharp dependency

## Files Created

1. `src/app/api/teams/extract-color/route.ts` - Color extraction API endpoint
2. `add-colour-column.sql` - Database migration script
3. `COLOR_EXTRACTION_IMPLEMENTATION.md` - This documentation

## Maintenance Notes

- **sharp library**: Keep updated for security and performance
- **Color validation**: Regex pattern enforces 6-digit hex format
- **API rate limiting**: Consider adding rate limits for color extraction endpoint
- **Caching**: Consider caching extracted colors to avoid re-processing

## Support

For issues or questions:
1. Check server logs for extraction errors
2. Verify sharp library is installed: `npm list sharp`
3. Confirm database migration was run successfully
4. Test with different image formats (PNG, JPEG, WebP, SVG)
