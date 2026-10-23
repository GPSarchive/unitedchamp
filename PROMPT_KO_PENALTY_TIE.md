# Prompt: Add Penalty-from-Draw Support for Knockout (KO) Matches

## Goal

In knockout (KO) stage matches, currently a draw (equal scores) is rejected — the API returns errors like "Knockout matches cannot finish level" and "Knockout matches cannot end in a draw". I want to allow KO matches to finish with a **tied score** when the match went to penalties, while still recording a **winner** who advances to the next round. I do NOT need to store the penalty shootout score — only the fact that it was decided by penalties and who won.

## What to Change

### 1. Database: Add a `is_penalty_result` boolean column to `matches`

Create a migration file `migrations/add-penalty-result.sql`:

```sql
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_penalty_result boolean NOT NULL DEFAULT false;
```

This flag means: "this KO match ended in a draw during regular/extra time, and the winner was decided by penalties."

### 2. Update TypeScript Types

**File: `src/app/lib/types.ts`**

Add `is_penalty_result` to `MatchRow` (around line 86-102):

```ts
export interface MatchRow {
  // ... existing fields ...
  is_penalty_result?: boolean; // true = KO match decided by penalties after a draw
}
```

Also add it to `BracketMatch` interface if relevant for bracket display.

### 3. Update API Route: `src/app/api/matches/[id]/route.ts`

This is the main PATCH endpoint. Key changes:

- **Add `is_penalty_result` to `UPDATABLE_FIELDS`** (line 22-32)
- **Change the KO draw validation** (around line 299-306). Currently:
  ```ts
  if (stageKind === "knockout") {
    if (effAS === effBS) {
      return jsonError(400, "Knockout matches cannot finish level; set a winner (pens).");
    }
    // ...auto-derive winner from scores
  }
  ```
  Change to:
  ```ts
  if (stageKind === "knockout") {
    const isPenalty = !!body.is_penalty_result;
    if (effAS === effBS) {
      if (!isPenalty) {
        return jsonError(400, "Knockout matches cannot finish level. Check 'penalty from draw' and select a winner.");
      }
      // Penalty result: scores are equal, but winner_team_id must be provided
      if (!effWinner || ![teamA, teamB].includes(effWinner)) {
        return jsonError(400, "For penalty results, you must select a winner (Team A or Team B).");
      }
      update.is_penalty_result = true;
      update.winner_team_id = effWinner;
    } else {
      // Normal KO win (scores differ) — existing logic
      update.is_penalty_result = false;
      const expected = effAS > effBS ? teamA : teamB;
      if (!effWinner) update.winner_team_id = expected;
      else if (effWinner !== expected) {
        return jsonError(400, "winner_team_id must match the scores for KO.");
      }
    }
  }
  ```

### 4. Update Server Action: `src/app/dashboard/tournaments/TournamentCURD/preview/updateMatchAction.ts`

**File: `src/app/dashboard/tournaments/TournamentCURD/preview/updateMatchAction.ts`**

Add `is_penalty_result` to `MatchUpdatePayload` interface:
```ts
export interface MatchUpdatePayload {
  // ... existing fields ...
  is_penalty_result?: boolean;
}
```

Change the KO validation block (around line 74-81) from:
```ts
if (stageKind === "knockout") {
  if (scoreA === scoreB) {
    return { success: false, error: "Knockout matches cannot end in a draw" };
  }
  if (!updateData.winner_team_id) {
    updateData.winner_team_id = scoreA > scoreB ? teamA : teamB;
  }
}
```
To:
```ts
if (stageKind === "knockout") {
  if (scoreA === scoreB) {
    if (!updateData.is_penalty_result) {
      return { success: false, error: "Knockout matches cannot end in a draw. Use penalty option." };
    }
    if (!updateData.winner_team_id || ![teamA, teamB].includes(updateData.winner_team_id)) {
      return { success: false, error: "For penalty results, select a winner." };
    }
    // Keep is_penalty_result = true, winner as selected
  } else {
    updateData.is_penalty_result = false;
    if (!updateData.winner_team_id) {
      updateData.winner_team_id = scoreA > scoreB ? teamA : teamB;
    }
  }
}
```

### 5. Stats Editor Save Action: `src/app/matches/[id]/actions.ts`

This file has a **separate code path** that finalizes matches from the stats editor (the `/matches/[id]` page). Around line 400-416, it checks `is_ko` and rejects ties:

```ts
if (matchData?.is_ko && isTie) {
  throw new Error('Knockout matches cannot end in a tie. A winner must be determined.');
}
```

And around line 419-428, it saves scores + winner:

```ts
const { error: upErr } = await supabase
  .from('matches')
  .update({
    team_a_score: aGoals,
    team_b_score: bGoals,
    winner_team_id,
    status: 'finished',
  })
  .eq('id', match_id);
```

**Change needed:** When `is_penalty_result` is true on the match row, allow the tie and use the already-set `winner_team_id` instead of calculating it from scores. Modify the logic to:

```ts
// Load match including penalty flag
const { data: matchData, error: matchErr } = await supabase
  .from('matches')
  .select('is_ko, is_penalty_result, winner_team_id')
  .eq('id', match_id)
  .single();

if (matchErr) throw matchErr;

if (matchData?.is_ko && isTie) {
  if (!matchData.is_penalty_result || !matchData.winner_team_id) {
    throw new Error('Knockout matches cannot end in a tie. Use the penalty option to select a winner first.');
  }
  // Penalty result: keep the tie score but use the pre-set winner
  winner_team_id = matchData.winner_team_id;
}
```

NOTE: In this flow, the admin would first set `is_penalty_result=true` and `winner_team_id` via the RowEditor/admin UI, then finalize via the stats editor. The stats editor recalculates scores from player stats — but the winner comes from the penalty selection.

### 6. Progression Logic: `src/app/dashboard/tournaments/TournamentCURD/progression.ts`

**NO changes needed** — progression already uses `winner_team_id` from the match row to propagate to the next KO round. Since we're still setting `winner_team_id`, the winner will correctly advance.

Verify that the `finishMatchAndProgress` function (around line 249-269) and `progressAfterMatch` (line 274+) both rely on `m.winner_team_id` — they do.

### 7. UI: Admin Match Editor — `src/app/dashboard/matches/RowEditor.tsx`

This is the main admin editor opened from `/dashboard/matches`. Changes:

**a)** Add `is_penalty_result` to form state (around line 91-100):
```ts
const [form, setForm] = useState<Partial<MatchRow>>(() => ({
  // ... existing fields ...
  is_penalty_result: initial.is_penalty_result ?? false,
}));
```

**b)** Add derived state (after `isDraw` on line 123):
```ts
const isPenaltyMode = isFinished && !allowDraws && scoresEqual && !!form.is_penalty_result;
```

**c)** Update validation logic (around line 132-148). The current block for `!allowDraws` requires a winner when scores are equal but has no penalty concept. Change:
```ts
if (isFinished) {
  if (allowDraws && scoresEqual) {
    if (form.winner_team_id != null) return "Winner must be empty for a draw.";
  } else if (!allowDraws && scoresEqual) {
    // KO penalty path
    if (!form.is_penalty_result) return "Knockout draw: check 'Penalty from draw' and pick a winner.";
    if (!form.winner_team_id) return "Select a penalty winner.";
    if (![form.team_a_id, form.team_b_id].includes(form.winner_team_id))
      return "Winner must be Team A or Team B";
  } else {
    // Scores differ — normal winner required
    if (!form.winner_team_id) return "Winner is required when status is 'finished'.";
    if (![form.team_a_id, form.team_b_id].includes(form.winner_team_id))
      return "Winner must be Team A or Team B";
  }
}
```

**d)** Update the save payload (around line 163-171) to include `is_penalty_result`:
```ts
const payload = {
  // ... existing fields ...
  is_penalty_result: isFinished && !allowDraws && scoresEqual ? !!form.is_penalty_result : false,
  winner_team_id: isFinished
    ? (allowDraws && scoresEqual ? null : form.winner_team_id)
    : null,
};
```

**e)** Add the UI checkbox + winner select in the Status section (around line 348-354). Add this block right after the existing winner `<select>` and its helper messages. Only show when: `isFinished && !allowDraws && scoresEqual`:

```tsx
{isFinished && !allowDraws && scoresEqual && (
  <div className="lg:col-span-2 space-y-3 rounded-md border border-amber-400/20 bg-amber-900/10 p-3">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        checked={!!form.is_penalty_result}
        onChange={(e) => {
          set("is_penalty_result", e.target.checked);
          if (!e.target.checked) set("winner_team_id", null);
        }}
        className="h-4 w-4 rounded border-white/20 bg-zinc-900 text-amber-500 focus:ring-amber-400/40"
      />
      <span className="text-sm text-amber-200 font-medium">
        Πέναλτυ από ισοπαλία (KO στάδιο)
      </span>
    </label>

    {!!form.is_penalty_result && (
      <div className="space-y-2">
        <span className="text-xs text-white/70">Νικητής πέναλτυ:</span>
        <div className="flex gap-3">
          {[form.team_a_id, form.team_b_id].filter(Boolean).map((id) => {
            const t = teams.find((x) => x.id === id) ?? null;
            return (
              <label key={id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="penalty_winner"
                  checked={form.winner_team_id === id}
                  onChange={() => set("winner_team_id", id as Id)}
                  className="h-4 w-4 border-white/20 bg-zinc-900 text-amber-500 focus:ring-amber-400/40"
                />
                <span className="text-sm text-white">
                  {t ? t.name : `#${id}`}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    )}
  </div>
)}
```

### 8. UI: Tournament Planner Editor — `src/app/dashboard/tournaments/TournamentCURD/preview/ExpandedRowEditor.tsx`

Apply the same pattern:

**a)** Add local state:
```ts
const [localIsPenalty, setLocalIsPenalty] = useState((match as any).is_penalty_result ?? false);
```

**b)** Update `handleSave` patch to include `is_penalty_result`:
```ts
const patch = {
  // ... existing ...
  is_penalty_result: isFinished && !allowDraws && scoresEqual ? localIsPenalty : false,
};
```

And the server call:
```ts
await updateMatch({
  // ... existing ...
  is_penalty_result: patch.is_penalty_result,
});
```

**c)** Update validation: same logic as RowEditor — allow equal scores when `localIsPenalty` is true and a winner is selected.

**d)** Add the same checkbox + radio UI in the form grid, visible when `isFinished && !allowDraws && scoresEqual`.

### 9. Auto-clear logic

When the checkbox is **unchecked**, clear `winner_team_id` back to null (since equal scores without penalty = invalid for KO).

When scores become **unequal**, auto-uncheck `is_penalty_result` and auto-set winner from scores.

## Summary of Files to Modify

| File | Change |
|------|--------|
| `migrations/add-penalty-result.sql` | NEW — add `is_penalty_result` column |
| `src/app/lib/types.ts` | Add `is_penalty_result` to `MatchRow` |
| `src/app/api/matches/[id]/route.ts` | Allow KO draws when penalty flag is set; add to UPDATABLE_FIELDS |
| `src/app/matches/[id]/actions.ts` | Allow KO tie when `is_penalty_result` is true; use pre-set winner |
| `src/app/dashboard/tournaments/TournamentCURD/preview/updateMatchAction.ts` | Allow KO draws when penalty flag set; add to payload type |
| `src/app/dashboard/matches/RowEditor.tsx` | Add penalty checkbox + winner radio buttons UI |
| `src/app/dashboard/tournaments/TournamentCURD/preview/ExpandedRowEditor.tsx` | Same penalty UI additions |

## What NOT to Change

- **Progression logic** (`progression.ts`) — already works via `winner_team_id`
- **Penalty scores** — we do NOT store them; only the boolean flag + winner
- **Database schema for scores** — keep `team_a_score` / `team_b_score` as the regular-time score
- **Group/league stage logic** — draws remain allowed as-is for non-KO stages

## UI Behavior Summary

1. Admin opens a KO match editor
2. Sets status to "finished", enters tied scores (e.g., 2-2)
3. A warning appears: "Draws not allowed for this stage"
4. A new section appears with checkbox: **"Πέναλτυ από ισοπαλία (KO στάδιο)"**
5. Admin checks it → radio buttons appear showing both team names
6. Admin selects the penalty winner → validation passes
7. Save → match is saved with `{ team_a_score: 2, team_b_score: 2, is_penalty_result: true, winner_team_id: <selected> }`
8. Progression fires → winner advances to next KO round as normal
