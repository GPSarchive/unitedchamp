# Plan: Harden the filtering & sort logic on `/paiktes`

> **Hand-off note:** This plan is self-contained for a fresh session. Read *Context* → *Data flow today* → *Tasks* in order. The live page logic is in `src/app/paiktes/page.tsx` (a Server Component). A correctness bug here was already fixed (see *Already done*); this plan covers the remaining logic debt.

## Context

`/paiktes` is a server-rendered player directory. `page.tsx` reads pre-computed stats from `player_career_stats` (one row per player) and `player_tournament_stats` (one row per player per tournament), joins teams, then filters / sorts / paginates. The client (`PlayersClient.tsx`) drives all of this through URL search params (`sort`, `tournament_id`, `top`, `page`, `q`). Search supports Greek/Latin transliteration and a field syntax (`team:`, `position:`, `goals:>N`, `matches:>N`, `assists:>N`) parsed by `src/app/lib/searchUtils.ts`.

**The architecture is split-brained across the codebase** and that's the core thing to be aware of:
- **Public** `/paiktes` → **server-side** filter/sort/paginate in `page.tsx` (scales, but logic is intricate).
- **Admin** `src/app/dashboard/preview/player-list/AdminPlayersListView.tsx` and `.../player-list-mobile/MobilePlayersView.tsx` → **fetch-once + client-side** filter/sort/top-N in a single `filteredRows` `useMemo` (clean, but doesn't scale and re-implements the same `parseSearchQuery` semantics differently).

This plan does **not** force a rewrite to one model. It hardens the public server-side path and removes duplicated logic. If the user wants the unified rewrite, that's a separate, larger effort (note it but don't start it without explicit go-ahead).

## Data flow today (read `src/app/paiktes/page.tsx` top to bottom)

1. Parse search params → `sortMode`, `tournamentId`, `topN`, `page`, `rawSearchTerm`. `parsedSearch = parseSearchQuery(rawSearchTerm)`.
2. Fetch tournaments (dropdown).
3. **Team filter** (`parsedSearch.team`) → resolve team names to ids → `player_teams` → `teamFilteredPlayerIds`.
4. **Tournament filter** (`tournamentId`) → `player_tournament_stats` → `tournamentPlayerIds`.
5. Combine the two id-sets into `combinedPlayerIds` (intersection if both present).
6. Build `playersQuery` against `player` (soft-delete filtered via `.is("deleted_at", null)`), apply `combinedPlayerIds`, **position filter**, **name search** (multi-variant `or(...ilike...)`).
7. `shouldDeferPagination = !!tournamentId || sortMode !== "alpha" || hasStatFilter` — when true, fetch up to `.limit(10000)`; else `.range(offset, offset+pageSize-1)`.
8. Enrich: join career stats, tournament stats (if scoped), teams; compute age; rank teams (primary first).
9. **Stat filters** (`minGoals`/`minMatches`/`minAssists`) run in JS over `enriched`.
10. **Sort** via `metric()` (tournament value when scoped, else career).
11. **Pagination**: if deferred, `finalTotalCount = enriched.length` and `enriched.slice(offset, offset+pageSize)`; else use DB `count`.

## Already done (do NOT redo)

The count/filter mismatch bug is **fixed**: `hasStatFilter` was added to `shouldDeferPagination` (step 7) so that when `goals:>N` / `matches:>N` / `assists:>N` is active, the page defers pagination, applies the JS filter over the full set, then recomputes `finalTotalCount` from the filtered length. Before the fix, a stat filter combined with the default alpha sort filtered only the current 50-row page while reporting the unfiltered DB count. Verify it still holds before building on top; don't reintroduce the bug.

## Known remaining issues (the actual work)

### A. Stat filters run in JS, not SQL — they don't scale and partially contradict the "pre-computed stats" design
`minGoals`/`minMatches`/`minAssists` are applied **after** fetching up to 10,000 player rows + joining career stats in JS (`page.tsx` ~377-385). Since the values live in `player_career_stats`, these can be real `WHERE` clauses. Moving them into SQL:
- lets the DB do the filtering and the count in one query (no JS-side recompute),
- removes the 10k ceiling exposure for the stat-filter case,
- aligns with why the pre-computed tables exist.
**Caveat:** career-stat filters are straightforward (`player_career_stats.total_goals >= N`). **Tournament-scoped** stat filters are harder because the active stat source switches to `player_tournament_stats`; decide whether stat filters apply to career or tournament values when a tournament is selected (today the JS filter always uses career `goals`/`matches`/`assists`, even when tournament-scoped — that's an inconsistency to resolve, see issue C).

### B. The 10,000-row ceiling is a silent cliff
`page.tsx` `fetchInBatches` caps each chunk at `.limit(10000)` and the deferred player query uses `.limit(10000)`. Fine today; silently truncates when the league grows. Either:
- raise/remove with proper batching + true count, or
- at minimum, detect truncation (`data.length === 10000`) and log/surface it so it fails loud, not silent.

### C. Two different guards for `tournamentId` truthiness vs finiteness
`tournamentId` is `null` when absent. The filter uses `Number.isFinite(tournamentId)` (~159), but later code uses `if (tournamentId)` truthiness (~264, ~358) and `hasTournament = !!tournamentId`. These mostly agree but are inconsistent and invite bugs (e.g. `tournament_id=0` would behave differently between the two). Pick one canonical normalized value (`const activeTournamentId: number | null`) computed once and use it everywhere. While here, resolve the issue noted in A: when a tournament is scoped, should `goals:>N` filter on tournament goals or career goals? Document the decision and make the filter + the displayed stat agree (today `PlayersList.tsx`/`PlayerProfileCard.tsx` *display* tournament-scoped stats, but the *filter* uses career — pick one).

### D. Triplicated stat-resolution logic (the "scoped vs career" ternary)
The pattern `isTournamentScoped && player.tournament_X !== undefined ? player.tournament_X : player.X` is copy-pasted in three places:
- `PlayersList.tsx` ~85-107 (goals/matches/wins/assists/mvp/bestGk),
- `PlayerProfileCard.tsx` ~109-147 (matches/goals/assists/mvp/bestGk),
- `page.tsx` `metric()` ~390-401 (for sorting).
Extract one helper, e.g. in `src/app/paiktes/types.ts`:
```ts
export function resolveStat(
  p: PlayerLite,
  careerKey: keyof PlayerLite,
  scoped: boolean,
): number { /* prefer the tournament_* twin when scoped & defined, else career, else 0 */ }
```
Then use it in all three. Removes ~40 lines and the "updated one, forgot the other" failure mode.

### E. `searchUtils` semantics are duplicated between server and admin client
`page.tsx` consumes `parseSearchQuery` + `normalizeForSearch` and builds Supabase `.or()` ilike strings. The admin views (`AdminPlayersListView`, `MobilePlayersView`) consume the *same* parser but apply it with `matchesSearch` in JS, and notably **`MobilePlayersView` ignores `parsed.minMatches`** because its API doesn't return matches (see its inline `NOTE`). This isn't a bug on `/paiktes`, but if you touch the parser, grep all consumers (`parseSearchQuery`, `matchesSearch`, `normalizeForSearch`) and keep behavior consistent. Do not silently change parser semantics — three call sites depend on it.

## Tasks (do in order)

### Task 1 — Canonicalize `tournamentId` (issue C)
Compute one `activeTournamentId: number | null` near the top of `page.tsx` (finite-and-positive check) and replace every `tournamentId` truthiness/finite check downstream with it. No behavior change intended — pure consistency. Verify `?tournament_id=abc` and `?tournament_id=` both cleanly mean "no tournament".

### Task 2 — Extract `resolveStat` and dedupe (issue D)
Add `resolveStat` to `types.ts`; refactor the three call sites to use it. Pure refactor; the rendered numbers and sort order must be identical. `npx tsc --noEmit` clean.

### Task 3 — Decide & unify scoped-stat semantics (issue C/A overlap)
Decide: when a tournament is selected, do `goals:>N` / `matches:>N` / `assists:>N` filter on **tournament** or **career** values? Recommended: **match what's displayed** (tournament values when scoped), so the filter and the visible number agree. Implement consistently in the filter step and document it in a code comment + this plan's changelog.

### Task 4 — Push career-stat filters into SQL (issue A)
For the **non-tournament-scoped** case, convert `minGoals`/`minMatches`/`minAssists` JS filters into a join/filter against `player_career_stats` so the DB returns only matching players *and* an accurate count, removing the deferred-pagination JS recompute for that case. Keep the JS path as a fallback for the tournament-scoped case (or implement the tournament-scoped SQL filter too if Task 3 chose tournament values). Re-verify the count == filtered-results invariant from *Already done*.

### Task 5 — Make the 10k ceiling loud (issue B)
At minimum, detect `data.length >= 10000` in the deferred query and `fetchInBatches`, and `console.error('[paiktes] result truncated at 10000 ...')`. Better: paginate the underlying fetch. Pick based on how close current data is to the ceiling (check row counts in `player` / `player_tournament_stats`).

### Task 6 (OPTIONAL, needs decision) — Unify with the admin client architecture
Only if the user wants it. Either (a) make the admin views reuse a shared filtering module, or (b) move `/paiktes` filters fully into SQL so there's one server-authoritative path. This is a meaningful refactor across `page.tsx`, the two admin views, and possibly `/api/players`. **Do not start without explicit confirmation** — note the trade-off (consistency vs. risk) and let the user choose.

## How to test

Run `npm run dev` and exercise these URLs, checking both the rendered rows AND the "Σύνολο/total" count in the header agree with the visible filtered set:

- `/paiktes` — default alpha, page 1.
- `/paiktes?q=goals:>10` — alpha + stat filter (the previously-buggy case). Count must equal the number of players with >10 career goals, and pagination must page through *that* filtered set.
- `/paiktes?sort=goals` — career goals descending.
- `/paiktes?tournament_id=<id>&sort=tournament_goals` — tournament-scoped; stats shown and sorted must be tournament values.
- `/paiktes?tournament_id=<id>&q=goals:>5` — exercises Task 3's decision (does it filter tournament or career goals?). Confirm it matches the documented choice.
- `/paiktes?q=team:Παναθηναϊκός` and a Latin spelling of the same — transliteration still works.
- `/paiktes?q=position:Forward` and `?q=θέση:Επιθετικός`.
- `/paiktes?top=20&sort=goals` — top-N cap interacts correctly with sort.
- `/paiktes?page=2` and a page beyond the last — clamps sanely.

## Acceptance criteria

- [ ] One canonical `activeTournamentId`; no mixed truthiness/finite guards remain.
- [ ] `resolveStat` is the single source for scoped-vs-career stat selection (list, profile card, sort all use it).
- [ ] Scoped stat filters and displayed scoped stats agree (Task 3 decision documented in code).
- [ ] For career-stat filters, the DB does the filtering + count (or the JS path provably keeps count == filtered length).
- [ ] 10k truncation can no longer happen silently.
- [ ] All test URLs above show header count == visible filtered count.
- [ ] `npx tsc --noEmit` clean for `src/app/paiktes/**`.
- [ ] Parser semantics unchanged for the three `searchUtils` consumers (or changed deliberately in all three).

## Out of scope / do NOT touch

- Visual/animation/render cost. That's the *other* plan (`paiktes-render-cost.md`).
- The `searchUtils` transliteration maps (Greek↔Latin) — correct as-is; only touch if a test reveals a real gap.
- Rewriting the admin views unless Task 6 is explicitly approved.
