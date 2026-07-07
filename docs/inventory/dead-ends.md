# Dead ends

Running list of files / routes / RPCs that look orphaned or obsolete. **Nothing here has been verified by a full usage check yet** — each entry needs a quick grep before deletion.

The status column uses:
- **🔴 high confidence** — typo names, "copy" suffixes, marked deprecated in code
- **🟡 likely** — superseded by a newer file, no obvious consumers
- **🟢 needs verification** — flagged because of duplication patterns

---

## Routes

| Route | Status | Reason |
|---|---|---|
| `/hometest` (and `/hometest/home`) | 🟡 | Older home variant with verbose `withConsoleTiming` debug logging. Not linked from Navbar/Footer (to verify). |
| `/waves` | 🟢 | Standalone demo of `components/Waves.tsx`. |
| `/dotgrid` | 🟢 | Standalone demo of `OMADES/DotGrid.tsx`. |

---

## API endpoints

| Endpoint | Status | Reason |
|---|---|---|
| `/api/storage/sign` | 🔴 | Byte-identical to `/api/storage`. |
| `/api/debug/invocations` | 🔴 | Comment in source: "Temporary debug endpoint to track function invocations." |
| `/api/me` | 🟡 | Single GET using legacy `@supabase/auth-helpers-nextjs` while the rest of the codebase uses `@supabase/ssr`. Confirm callers. |

---

## Components

### Confirmed dead (typo / "copy" suffix)

| File | Reason |
|---|---|
| `src/app/tournaments/LeaugeStage.tsx` | Typo of "League"; `stages/LeagueStage.tsx` is the canonical one. |
| `src/app/tournaments/useTournamentData copy.tsx` | Literal " copy" suffix. |
| `src/app/tournaments/stages/koStage/KOStageViewer copy.tsx` | Literal " copy" suffix. |
| `src/app/tournaments/stages/koStage/KoStageDisplayTest.tsx` | "Test" suffix; sandbox file. |
| `src/app/tournaments/TournamentDebug.tsx` | "Debug" — probably never rendered in prod. |
| `src/app/home/newEventPilll.tsx` | Triple-L typo. |
| `src/app/dashboard/tournaments/TournamentCURD/preview/ModernKnockoutViewesr.tsx` | "Viewesr" typo. |

### Likely dead (superseded)

| File | Reason |
|---|---|
| `src/components/DotGrid.jsx` + `DotGrid.css` | TSX version at `src/app/OMADES/DotGrid.tsx` is the live one. Only consumer of the JSX version is `/dotgrid` demo route. |
| `src/components/Waves.tsx` + `Waves.css` | Only consumed by `/waves` demo route. |
| `src/app/home/Calendar.tsx` | Classic variant; `/preview/home-c` uses `EnhancedMobileCalendar` and `/` uses `EditorialCalendar`. May only be used by `/hometest`. |
| `src/app/home/TeamDashboard.tsx` | Classic; `/` uses `EditorialTeamDashboard`. |
| `src/app/home/TopPlayersSection.tsx` | Classic; `/` uses `EditorialTopPlayersSection`. |
| `src/app/home/TournamentsGrid.tsx` | Classic; `/` uses `EditorialTournamentsGrid`. |
| `src/app/home/ResponsiveCalendar.tsx` | Confirm consumers; may be unused intermediate. |
| `src/app/home/StaticDotGrid.tsx` | Confirm consumers. |
| `src/app/home/MultiMatchCluster.tsx` (+ `.module.css`) | Confirm consumers. |
| `src/app/home/EventPillShrimp.tsx` (+ `.module.css`) | Whimsical name; confirm whether it's still referenced by any calendar variant. |
| `src/app/tournaments/GroupsStage.tsx` | Duplicate of `tournaments/stages/GroupsStage.tsx`. |
| `src/app/tournaments/LeaugeStage.tsx` | (also listed above — typo dupe of `stages/LeagueStage.tsx`) |
| `src/app/tournaments/TournamentClient.tsx` | Possibly older single-tournament client; check whether `[id]/v2/TournamentClientV2.tsx` / `[id]/v2-dark/TournamentClientV2Dark.tsx` superseded it. |
| `src/app/paiktes/ProfileCard.tsx` | `PlayerProfileCard.tsx` exists alongside; one is older. |
| `src/app/OMADES/TeamsGrid.tsx` | Page imports `TeamCard` directly — no obvious consumer of the grid wrapper. |

### Lib

| File | Reason |
|---|---|
| `src/app/lib/player-images.ts` | Marked `@deprecated` in code — use `OptimizedImage`. |
| `src/app/lib/supabase/client.ts` | Legacy `@supabase/auth-helpers-nextjs` browser client; `supabaseBrowser.ts` is the modern replacement. |
| `src/app/lib/supabase/Server.ts` | Near-duplicate of `supabaseServer.ts`; only consumer is `src/app/matches/[id]/page.tsx`. |
| `src/app/lib/supabase/supabaseClient.ts` | Plain anon client; confirm consumers. |
| `src/app/lib/supabase/signDbToken.ts` | Exports `signDbToken` — no call sites found in main grep. |

---

## DB / RPCs

| Name | Status | Reason |
|---|---|---|
| `users` table | 🟡 | Only call: `/hometest/page.tsx` reads `from('users')`. Auth users live in `auth.users`. Likely a leftover from early scaffolding. |
| `increment_article_view_count(slug)` RPC | 🟢 | Defined in [add-view-count-to-articles.sql](../../migrations/add-view-count-to-articles.sql) but no caller found in grep. View-count writes happen through some other path or not at all. |
| `test_admin_role` RPC | 🟢 | Called from `dashboard/matches/MatchesDashboard.tsx`. Name suggests test/diagnostic — confirm it's still needed. |
| `player_statistics` table (one of two stats homes) | 🟢 | `player_career_stats` was introduced to replace expensive per-page aggregation, but `player_statistics` is still written by match-finish flows. Pick one canonical, drop the other. |

---

## Migrations / SQL

| File | Reason |
|---|---|
| `check-articles-rls.sql`, `check-articles.sql`, `verify-articles-schema.sql` | Inspection / verification queries — not migrations. Either keep in a `migrations/checks/` subfolder or delete. |
| `fix-duplicates-constraints.sql` | One-shot fix; flag for archival once confirmed applied to prod. |
| `add-match-postponement.sql` vs `add-match-postponement-safe.sql` | Two versions of the same migration; only the "safe" one should be in this folder. |
| `add-colour-column.sql` (root) and `add-player-number-column.sql` (root) | These two live in the repo root, not in `migrations/`. Move them. |

---

## How to use this list

1. **Pick one entry.** Don't bulk-delete.
2. **Grep the symbol or filename** across `src/` to confirm no live imports.
3. **Trace dynamic imports** if applicable (`next/dynamic`).
4. **Check `git log`** to understand why the file was added.
5. **Delete in a small PR**, watch CI, ship.

Re-confirmation by a `Explore` subagent is the fastest way to triage a batch — point it at this file and ask for a per-entry "has 0 consumers / has N consumers" verdict.
