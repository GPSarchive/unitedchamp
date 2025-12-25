# Paiktes (Players) Search Features

## Overview

The players page now features an advanced server-side search system with field-specific queries, Greek/Latin transliteration, and unified pagination.

## Features Implemented

### 1. ✅ Greek Diacritic Normalization

Search works with or without Greek accents:
- "Αντώνης" = "Αντωνης" = "Antonis"
- "Γιώργος" = "Γιωργος" = "Giorgos"

### 2. ✅ Field-Specific Search

Use special syntax to search specific fields:

#### Basic Syntax
```
field:value
```

#### Supported Fields

| Field | Greek Alias | Example | Description |
|-------|-------------|---------|-------------|
| `team:` | `ομάδα:` | `team:Παναθηναϊκός` | Search by team name |
| `position:` | `θέση:` | `position:Forward` | Search by position |
| `goals:` | `γκολ:` | `goals:>10` | Filter by minimum goals |
| `matches:` | `αγώνες:` | `matches:>5` | Filter by minimum matches |
| `assists:` | `ασίστ:` | `assists:>3` | Filter by minimum assists |

### 3. ✅ Combined Search Queries

Mix field-specific and text searches:

```
Γιώργος team:Παναθηναϊκός goals:>10
```

This searches for players named "Γιώργος" in team "Παναθηναϊκός" with more than 10 goals.

### 4. ✅ Greek/Latin Transliteration

Search works in both Greek and Latin characters:

| Greek Input | Latin Input | Matches |
|-------------|-------------|---------|
| Γιώργος | Giorgos | ✅ Both work |
| Παναθηναϊκός | Panathinaikos | ✅ Both work |
| Θέση | Thesi | ✅ Both work |

### 5. ✅ Server-Side Search

All search and filtering now happens on the server:
- **No data loss** - searches across all players, not just loaded page
- **Better performance** - SQL-optimized queries
- **Pagination friendly** - consistent pagination regardless of filters

### 6. ✅ Unified Pagination

Pagination now works consistently:
- Always 50 players per page
- Works with all search filters
- No confusing behavior changes

## Usage Examples

### Basic Name Search
```
Γιώργος
```
Finds all players with "Γιώργος" in first or last name (works with or without accents)

### Team Search
```
team:ΠΑΟΚ
```
Finds all players in ΠΑΟΚ team

### Position Search
```
position:goalkeeper
```
Finds all goalkeepers

### Stats Filter
```
goals:>15
```
Finds players with more than 15 goals

### Combined Search
```
team:Ολυμπιακός position:Forward goals:>10
```
Finds forwards in Ολυμπιακός with more than 10 goals

### Mixed Greek/Latin
```
Antonis team:Παναθηναϊκός
```
Works! Searches "Antonis" (Latin) in team "Παναθηναϊκός" (Greek)

## Technical Implementation

### Files Modified

1. **`/src/app/lib/searchUtils.ts`** (NEW)
   - Greek diacritic normalization
   - Greek ↔ Latin transliteration
   - Search query parser
   - Text matching utilities

2. **`/src/app/paiktes/page.tsx`**
   - Server-side search implementation
   - SQL query building with filters
   - Team name search via join
   - Position search with ILIKE
   - Stats filtering after enrichment
   - Unified pagination (always 50 per page)

3. **`/src/app/paiktes/PlayersClient.tsx`**
   - Removed client-side filtering
   - Simplified to display server results
   - Debounced search (500ms)

4. **`/src/app/paiktes/PlayersFilterHeader.tsx`**
   - Added search syntax help text
   - Updated placeholder with examples

### Search Flow

```
User types → 500ms debounce → URL update → Server fetch → SQL query → Results
```

### Database Queries

The search system builds efficient SQL queries:

```typescript
// Team filter
SELECT player_id FROM player_teams
WHERE team_id IN (
  SELECT id FROM teams WHERE name ILIKE '%search%'
)

// Position filter
SELECT * FROM player WHERE position ILIKE '%forward%'

// Name search (with Greek variants)
SELECT * FROM player WHERE
  first_name ILIKE '%γιωργος%' OR
  first_name ILIKE '%giorgos%' OR
  last_name ILIKE '%γιωργος%' OR
  last_name ILIKE '%giorgos%'

// Stats filters (post-query)
Filter enriched data where goals >= 10
```

## Performance Considerations

1. **Debounce Time**: 500ms prevents excessive server requests while typing
2. **Pagination**: Always 50 items per page for consistent performance
3. **Index Recommendations**: Consider adding indexes on:
   - `teams.name` (for team search)
   - `player.position` (for position filter)
   - `player.first_name, player.last_name` (for name search)

## Future Enhancements

Potential improvements:
- [ ] Search history/recent searches
- [ ] Autocomplete suggestions
- [ ] Save search filters as presets
- [ ] Export search results
- [ ] More stats filters (age range, height, etc.)
- [ ] Fuzzy matching for typo tolerance
- [ ] Search result highlighting

## Troubleshooting

### Search not working?
1. Check server logs for SQL errors
2. Verify Supabase connection
3. Check browser network tab for API calls

### Greek characters not matching?
1. Ensure database uses UTF-8 encoding
2. Check `ILIKE` is case-insensitive in your DB
3. Verify transliteration mappings in `searchUtils.ts`

### Pagination issues?
1. Should always show pagination now (unified)
2. Check `totalCount` is returned from server
3. Verify `usePagination={true}` in page.tsx

## Testing

Test cases to verify:

- [ ] Greek name search: "Γιώργος"
- [ ] Latin name search: "Giorgos"
- [ ] Name with accents: "Αντώνης"
- [ ] Name without accents: "Αντωνης"
- [ ] Team search: "team:Παναθηναϊκός"
- [ ] Position search: "position:Forward"
- [ ] Stats filter: "goals:>10"
- [ ] Combined: "team:ΠΑΟΚ position:Forward goals:>5"
- [ ] Mixed language: "Antonis team:Ολυμπιακός"
- [ ] Pagination with filters
- [ ] Empty search results
- [ ] Special characters handling

## Example Search Queries

```
# Find top scorers
goals:>20

# Find ΠΑΟΚ forwards with 10+ goals
team:ΠΑΟΚ position:Forward goals:>10

# Find experienced goalkeepers
position:goalkeeper matches:>20

# Find players named Γιώργος in any team
Γιώργος

# Find productive midfielders
position:midfielder assists:>5 goals:>3

# Latin search for Greek team
team:Panathinaikos

# Complex multi-filter
team:Ολυμπιακός position:Forward goals:>15 assists:>5 matches:>10
```

## Support

For issues or questions about the search system, check:
1. This documentation
2. Code comments in `searchUtils.ts`
3. Console logs during development
4. Browser network tab for API responses
