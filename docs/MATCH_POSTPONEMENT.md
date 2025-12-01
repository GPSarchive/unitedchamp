# Match Postponement Feature - Documentation

## Overview

The Match Postponement feature allows administrators to reschedule matches and automatically notify users through announcements. This document explains how to use the new database fields and API endpoint.

---

## Database Changes

### New Fields in `matches` Table

| Field | Type | Nullable | Description |
|-------|------|----------|-------------|
| `postponement_reason` | TEXT | Yes | Human-readable reason why the match was postponed (e.g., "Bad weather", "Venue unavailable") |
| `original_match_date` | TIMESTAMPTZ | Yes | The original scheduled date before the first postponement |
| `postponed_at` | TIMESTAMPTZ | Yes | Timestamp when the match was postponed |
| `postponed_by` | UUID | Yes | Foreign key to `auth.users(id)` - the admin who postponed the match |

### Updated Status Values

The `status` field now accepts **three** values instead of two:

- `"scheduled"` - Match is scheduled and will happen on the `match_date`
- `"postponed"` - Match was rescheduled to a new date
- `"finished"` - Match has been completed

---

## How Postponement Works

### Field Behavior

1. **First Postponement**:
   - `original_match_date` is set to the current `match_date`
   - `match_date` is updated to the new date
   - `status` changes to `"postponed"`
   - `postponement_reason` stores the reason (if provided)
   - `postponed_at` records when the postponement happened
   - `postponed_by` stores the admin's UUID

2. **Subsequent Postponements**:
   - `original_match_date` **remains unchanged** (preserves the very first date)
   - `match_date` is updated to the latest new date
   - `postponed_at` is updated to the latest postponement timestamp
   - `postponement_reason` can be updated

3. **After Match Completes**:
   - When status changes to `"finished"`, all postponement fields remain intact
   - This preserves the historical record of the postponement

---

## API Endpoint

### `POST /api/matches/[id]/postpone`

**Authentication**: Requires admin role

**Request Body**:
```json
{
  "new_match_date": "2025-12-22T20:00:00.000Z",  // Required: ISO 8601 format
  "postponement_reason": "Κακές καιρικές συνθήκες"  // Optional: Greek or English text
}
```

**Success Response** (200):
```json
{
  "ok": true,
  "match": {
    "id": 123,
    "match_date": "2025-12-22T20:00:00.000Z",
    "status": "postponed",
    "postponement_reason": "Κακές καιρικές συνθήκες",
    "original_match_date": "2025-12-15T20:00:00.000Z",
    "postponed_at": "2025-12-01T10:30:00.000Z"
  },
  "announcement": {
    "id": 45,
    "title": "Αναβολή Αγώνα: Παναθηναϊκός - Ολυμπιακός"
  },
  "message": "Match postponed successfully from [...] to [...]"
}
```

**Error Responses**:

| Status | Error | Meaning |
|--------|-------|---------|
| 400 | "new_match_date is required" | Missing required field |
| 400 | "Invalid new_match_date format" | Date is not valid ISO 8601 |
| 400 | "New match date must be in the future" | Cannot postpone to a past date |
| 404 | "Match not found" | Invalid match ID |
| 409 | "Cannot postpone a finished match" | Only scheduled/postponed matches can be postponed |
| 401 | "Unauthorized" | User not authenticated |
| 403 | "Forbidden - admin role required" | User lacks admin role |

---

## Automatic Announcement Creation

When a match is postponed, the system **automatically creates a published announcement** with:

- **Title**: `"Αναβολή Αγώνα: [Team A] - [Team B]"`
- **Body**: Formatted message in Greek with:
  - Original scheduled date
  - New scheduled date
  - Postponement reason (if provided)
- **Status**: `published` (immediately visible)
- **Pinned**: `true` (appears at the top)
- **Priority**: `1` (highest)
- **Time Window**:
  - Starts immediately
  - Ends 1 day after the new match date

**Example Announcement**:

```
Ο αγώνας **Παναθηναϊκός** vs **Ολυμπιακός** που ήταν προγραμματισμένος για **Παρασκευή, 15 Δεκεμβρίου 2025, 20:00** αναβλήθηκε.

📅 **Νέα ημερομηνία**: Παρασκευή, 22 Δεκεμβρίου 2025, 20:00

ℹ️ **Λόγος**: Κακές καιρικές συνθήκες

Σας ευχαριστούμε για την κατανόησή σας.
```

---

## Usage Examples

### Example 1: Postpone Due to Weather

```bash
curl -X POST https://yourapp.com/api/matches/123/postpone \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "new_match_date": "2025-12-25T19:00:00.000Z",
    "postponement_reason": "Κακές καιρικές συνθήκες"
  }'
```

### Example 2: Postpone Without Reason

```bash
curl -X POST https://yourapp.com/api/matches/123/postpone \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "new_match_date": "2025-12-25T19:00:00.000Z"
  }'
```

### Example 3: Fetch from Frontend (Next.js Client Component)

```typescript
async function postponeMatch(matchId: number, newDate: string, reason?: string) {
  const response = await fetch(`/api/matches/${matchId}/postpone`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      new_match_date: newDate,
      postponement_reason: reason,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to postpone match');
  }

  return await response.json();
}

// Usage
try {
  const result = await postponeMatch(
    123,
    '2025-12-25T19:00:00.000Z',
    'Κακές καιρικές συνθήκες'
  );
  console.log('Match postponed:', result.message);
  console.log('Announcement created:', result.announcement?.title);
} catch (error) {
  console.error('Postponement failed:', error);
}
```

---

## Querying Postponed Matches

### Get All Postponed Matches

```sql
SELECT
  m.id,
  m.match_date as new_date,
  m.original_match_date,
  m.postponement_reason,
  m.postponed_at,
  ta.name as team_a_name,
  tb.name as team_b_name
FROM matches m
JOIN teams ta ON m.team_a_id = ta.id
JOIN teams tb ON m.team_b_id = tb.id
WHERE m.status = 'postponed'
ORDER BY m.postponed_at DESC;
```

### Get Postponement History for a Match

```typescript
const { data: match } = await supabase
  .from('matches')
  .select(`
    id,
    match_date,
    original_match_date,
    postponement_reason,
    postponed_at,
    postponed_by,
    teamA:teams!matches_team_a_id_fkey(name),
    teamB:teams!matches_team_b_id_fkey(name)
  `)
  .eq('id', matchId)
  .single();

if (match.status === 'postponed') {
  console.log('Original date:', match.original_match_date);
  console.log('Current date:', match.match_date);
  console.log('Postponed on:', match.postponed_at);
  console.log('Reason:', match.postponement_reason);
}
```

### Filter Matches by Postponement Reason

```typescript
const { data: weatherPostponed } = await supabase
  .from('matches')
  .select('*')
  .eq('status', 'postponed')
  .ilike('postponement_reason', '%καιρικές%');
```

---

## TypeScript Types

The updated types in `/src/app/lib/types.ts`:

```typescript
export type MatchStatus = "scheduled" | "postponed" | "finished";

export interface MatchRow {
  id: Id;
  match_date: string | null;
  status: MatchStatus;
  team_a_score: number;
  team_b_score: number;
  winner_team_id: Id | null;
  team_a_id: Id;
  team_b_id: Id;
  field?: string | null;

  // Postponement fields (added 2025-12-01)
  postponement_reason?: string | null;
  original_match_date?: string | null;
  postponed_at?: string | null;
  postponed_by?: string | null; // UUID
}
```

---

## Frontend Integration Points

### 1. Admin Dashboard - Quick Postpone Button

Add a "Postpone" button next to Edit/Delete in `/dashboard/matches/MatchesDashboard.tsx`:

```tsx
{match.status === 'scheduled' || match.status === 'postponed' ? (
  <button
    onClick={() => handlePostpone(match.id)}
    className="btn-postpone"
  >
    <ClockIcon /> Postpone
  </button>
) : null}
```

### 2. Match Card - Postponed Badge

Update `/tournaments/stages/MatchCard.tsx` to show postponed status:

```tsx
{match.status === 'postponed' && (
  <span className="badge-postponed">
    ΑΝΑΒΛΗΘΗΚΕ
  </span>
)}
```

### 3. Calendar - Visual Indicator

Update `/home/Calendar.tsx` to render postponed matches differently:

```tsx
status: match.status === 'postponed' ? 'postponed' : 'scheduled',
// Then in your event renderer:
if (event.status === 'postponed') {
  return <PostponedEventPill event={event} />;
}
```

---

## Database Migration Instructions

### Step 1: Connect to Your Database

```bash
# Using Supabase CLI
supabase db reset

# Or using psql
psql -h your-db-host -U postgres -d your-database
```

### Step 2: Run the Migration

```bash
# Copy the migration file to your database
psql -h your-db-host -U postgres -d your-database -f migrations/add-match-postponement.sql
```

### Step 3: Verify Migration

```sql
-- Check if columns were added
\d matches

-- Check if constraint was updated
SELECT constraint_name, check_clause
FROM information_schema.check_constraints
WHERE constraint_name = 'matches_status_check';

-- Should return: CHECK (status IN ('scheduled', 'finished', 'postponed'))
```

---

## Common Use Cases

### Use Case 1: Weather Postponement

**Scenario**: Bad weather forces a match to be rescheduled.

**Steps**:
1. Admin goes to `/dashboard/matches`
2. Finds the scheduled match
3. Clicks "Postpone" button
4. Selects new date (e.g., +7 days)
5. Enters reason: "Κακές καιρικές συνθήκες"
6. Confirms

**Result**:
- Match status → `postponed`
- Match appears on new date in calendar
- Announcement created and pinned to homepage
- Users see notification immediately

### Use Case 2: Venue Unavailable

**Scenario**: The field is double-booked.

**Steps**:
1. Same as above
2. Reason: "Έλλειψη γηπέδου"

**Result**: Same automatic flow

### Use Case 3: Second Postponement

**Scenario**: A postponed match needs to be postponed again.

**Steps**:
1. Match already has `status = 'postponed'`
2. Admin postpones again with new date
3. System updates `match_date` to latest date
4. `original_match_date` **stays unchanged** (preserves history)
5. `postponed_at` updates to current timestamp
6. New announcement created

**Result**:
- Historical record preserved
- Users get updated notification

---

## Security Considerations

### Authorization

- **Only admins can postpone matches** (checked via `user.app_metadata.roles`)
- Non-admin users receive `403 Forbidden`

### Validation

- New date must be in the future
- New date must be valid ISO 8601 format
- Only `scheduled` or `postponed` matches can be postponed
- Finished matches **cannot** be postponed

### Data Integrity

- `postponed_by` links to `auth.users(id)` with foreign key constraint
- All date fields use `TIMESTAMPTZ` for timezone safety
- Status constraint enforced at database level

---

## Troubleshooting

### Issue: "Cannot postpone a finished match"

**Cause**: Trying to postpone a match with `status = 'finished'`

**Solution**: Only scheduled matches can be postponed. If you need to change the date, update the match directly via PATCH.

---

### Issue: Announcement not created

**Cause**: Database permissions or announcement table issues

**Solution**:
1. Check Supabase RLS policies on `announcements` table
2. Ensure admin has INSERT permission
3. Check server logs for announcement creation errors

**Note**: The match postponement will still succeed even if announcement creation fails.

---

### Issue: "New match date must be in the future"

**Cause**: Selected date is in the past or current time

**Solution**: Select a date/time that is after the current moment (server time).

---

## Next Steps

After implementing this backend, you'll want to:

1. **Create a Postpone Dialog Component** (`PostponeDialog.tsx`)
   - Date/time picker
   - Reason dropdown or text input
   - Submit button

2. **Update Match Card UI** to show postponed badge

3. **Update Calendar** to visually distinguish postponed matches

4. **Add Filters** to admin dashboard for "Show only postponed matches"

5. **Create Analytics** to track postponement frequency and reasons

---

## Support

For questions or issues, check:
- [Next.js API Routes Documentation](https://nextjs.org/docs/app/building-your-application/routing/route-handlers)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [PostgreSQL TIMESTAMPTZ](https://www.postgresql.org/docs/current/datatype-datetime.html)
