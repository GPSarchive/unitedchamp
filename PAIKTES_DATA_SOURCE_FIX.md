# Paiktes Page Data Source Fix

## Issue Identified
The paiktes (players) page was incorrectly using `match_player_stats` table as the source for counting match participation. This led to inaccurate match counts because:

1. **`match_player_stats`** contains performance statistics (goals, assists, cards, awards)
2. A player can participate in a match without having any stats entries (e.g., played but no goals/assists)
3. The stats table is secondary - it's only populated when stats are recorded

## Correct Data Architecture

### `match_participants` - Source of Truth for Participation
- **Purpose**: Records who actually played in each match
- **Key field**: `played` (boolean) - indicates actual participation
- **Usage**: Should be used for counting matches played

### `match_player_stats` - Performance Statistics
- **Purpose**: Records what players did during matches (goals, assists, cards, awards)
- **Constraint**: Only exists for players who participated AND have recorded stats
- **Usage**: Should be used for performance metrics (MVP, goals, assists, etc.)

## Changes Made

### 1. Global Match Counting (Lines 337-397)
**Before:**
```typescript
// ❌ WRONG: Counting from match_player_stats
const { data: mps } = await supabaseAdmin
  .from("match_player_stats")
  .select("player_id, match_id, team_id, mvp, best_goalkeeper")
  .in("player_id", playerIds)
```

**After:**
```typescript
// ✅ CORRECT: Count from match_participants
const { data: participants } = await supabaseAdmin
  .from("match_participants")
  .select("player_id, match_id, team_id, played")
  .in("player_id", playerIds)
  .eq("played", true) // Only count actual participation

// ✅ Separately fetch match_player_stats for awards
const { data: mps } = await supabaseAdmin
  .from("match_player_stats")
  .select("player_id, match_id, team_id, mvp, best_goalkeeper")
  .in("player_id", playerIds)
```

### 2. Tournament-Scoped Match Counting (Lines 509-640)
**Before:**
```typescript
// ❌ WRONG: Counting tournament matches from stats
const { data: mpsRows } = await supabaseAdmin
  .from("match_player_stats")
  .select("match_id, player_id, team_id, goals, assists, ...")
  .in("match_id", tMatchIds);
```

**After:**
```typescript
// ✅ CORRECT: Count from match_participants
const { data: tParticipants } = await supabaseAdmin
  .from("match_participants")
  .select("player_id, match_id, team_id, played")
  .in("match_id", tMatchIds)
  .eq("played", true);

// ✅ Separately fetch stats for performance data
const { data: mpsRows } = await supabaseAdmin
  .from("match_player_stats")
  .select("match_id, player_id, team_id, goals, assists, ...")
  .in("match_id", tMatchIds);
```

### 3. Wins Calculation
**Before:**
```typescript
// ❌ WRONG: Wins calculated from stats records
for (const r of mpsRows) {
  const winner = winnerByMatch.get(r.match_id);
  if (winner != null && winner === r.team_id) {
    winsByPlayer.set(r.player_id, (winsByPlayer.get(r.player_id) ?? 0) + 1);
  }
}
```

**After:**
```typescript
// ✅ CORRECT: Wins calculated from participation records
for (const r of participantRows) {
  const winner = winnerByMatch.get(r.match_id);
  if (winner != null && winner === r.team_id) {
    winsByPlayer.set(r.player_id, (winsByPlayer.get(r.player_id) ?? 0) + 1);
  }
}
```

## Impact

### What's Fixed:
1. **Accurate match counts**: Players now show correct number of matches played (from `match_participants`)
2. **Correct tournament filtering**: When filtering by tournament, match counts are accurate
3. **Proper wins calculation**: Win counts based on actual participation, not stats entries
4. **Team ranking by participation**: Main team determination uses actual matches played for each team

### What Still Works:
1. **MVP awards**: Still correctly tracked from `match_player_stats`
2. **Best goalkeeper awards**: Still correctly tracked from `match_player_stats`
3. **Goals, assists, cards**: Still correctly tracked from `match_player_stats`
4. **All existing filters and sorting**: Continue to work as expected

## Testing Recommendations

1. **Verify match counts match actual participation records in the database**
2. **Check tournament filtering shows correct player counts**
3. **Ensure players with participation but no stats show up correctly**
4. **Verify MVP/awards still display correctly**
5. **Test sorting by matches/goals/wins/assists works properly**

## Database Schema Reference

```sql
CREATE TABLE public.match_participants (
  id bigint PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES matches(id),
  team_id bigint NOT NULL REFERENCES teams(id),
  player_id bigint NOT NULL REFERENCES player(id),
  played boolean NOT NULL DEFAULT false, -- ✅ Key field for participation
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.match_player_stats (
  id bigint PRIMARY KEY,
  match_id bigint NOT NULL REFERENCES matches(id),
  team_id bigint NOT NULL REFERENCES teams(id),
  player_id bigint NOT NULL REFERENCES player(id),
  goals integer NOT NULL DEFAULT 0,
  assists integer NOT NULL DEFAULT 0,
  mvp boolean NOT NULL DEFAULT false, -- ✅ Award fields
  best_goalkeeper boolean NOT NULL DEFAULT false, -- ✅ Award fields
  yellow_cards integer NOT NULL DEFAULT 0,
  red_cards integer NOT NULL DEFAULT 0,
  blue_cards integer NOT NULL DEFAULT 0,
  -- ... other performance fields
);
```

## Related Files
- `/src/app/paiktes/page.tsx` - Main fix location
- `/src/app/matches/[id]/actions.ts` - Shows how participation is managed (lines 175-221)
- `/src/app/matches/[id]/queries.ts` - Shows both tables being queried separately
