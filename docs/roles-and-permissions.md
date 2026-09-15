# Roles & permissions — what each role can really do

Verified against `main` (375afda) on 2026-09-14, before onboarding new admins.
Three layers grant or deny access; they do **not** agree with each other, and
that disagreement is the main finding (§5). The database side of this picture
comes from running [scripts/investigate-roles.sql](../scripts/investigate-roles.sql)
in the Supabase SQL editor — this document is the code side.

## 1. The roles

| Role | Where it lives | Who sets it |
|---|---|---|
| `admin` | `auth.users.app_metadata.roles` (JSON array) | `POST /api/admin/users/[id]/roles` — only an admin, only for **another** account, never removing the last admin (`lib/roleChange.ts`); or by hand in Supabase Studio, where the DB trigger still refuses to lose the last admin. Both paths are recorded in the audit log. |
| `editor` | same array | same route |
| *(none)* | any signed-up account — **sign-up is open** (`/sign-up`) | — |
| `ADMIN_EMAIL` (env) | not a role: `proxy.ts` treats the account with this email as admin **for dashboard page access only** | — |

An account without a role can log in but has no write path: every route and
action checks `app_metadata.roles`, and RLS gives it nothing beyond anonymous
reads.

## 2. Layer 1 — `src/proxy.ts` (runs on every non-static request)

| Request | Rule |
|---|---|
| `/dashboard/*` | must be logged in. `editor` may open only `/dashboard`, `/dashboard/articles*`, `/dashboard/announcements*`, `/dashboard/players*`, `/dashboard/teams*` (the list lives in `lib/dashboardAccess.ts`, shared with the sidebar and the home cards); anything else → `/403`. `admin` (or `ADMIN_EMAIL`) opens everything. |
| `/api/*` POST/PUT/PATCH/DELETE (except `/api/auth/*`, `/api/public/*`) | must be logged in (**any** account). The role check is the handler's job. |
| Server Actions (a POST to a page URL) | **not gated here**; each action checks itself. |
| `/preview/*` | **not gated at all** — see finding 3. |

## 3. Layer 2 — route handlers and server actions

Legend: *RLS* = writes through the cookie-bound client (the user's own JWT, RLS
applies); *service* = writes through the service role (RLS bypassed, the code's
check is the only gate).

### Admin only

| Surface | Client |
|---|---|
| `POST /api/matches` (create) | RLS |
| `DELETE /api/players/[id]` (archive) · `POST …/restore` | RLS |
| `DELETE /api/teams/[id]` (archive) · `POST …/restore` | RLS |
| `POST /api/tournaments/[id]/save-all` · `GET …/snapshot` · `POST /api/stages/[id]/reseed` | service |
| `createTournamentAction`, `listTournamentsAction`, `getTournamentForEditAction` (`TournamentCURD/actions.ts`) and the `/api/tournoua` variant | service / RPC |
| `updateMatchFromPlanner`, `batchUpdateMatches`, `revertMatchToScheduledAction`, `awardForfeitWinAction`, `saveMatchStatsAction` (`TournamentCURD/preview`), `applyPointAdjustmentAction`, `getDisciplinaryHistoryAction` | RLS |
| all seven `dashboard/seasons/actions.ts` actions · all four `dashboard/geniki-katataxi/actions.ts` actions | service / RPC |
| storage: `GET /api/storage`, `/api/storage/sign`, `POST …/tournaments/image-upload`, `GET …/tournament-img-loader`; `POST …/delete-object` for any path outside `players/` | service |
| `POST /api/admin/users/[id]/roles` · `GET /api/debug/invocations` | GoTrue admin / KV |

### Admin **or** editor (`canEditContent`)

| Surface | Client | Note |
|---|---|---|
| `/api/articles` POST · `/api/articles/[id]` PATCH+DELETE (+ draft visibility) | RLS | the intended editor job |
| `/api/announcements` POST · `/api/announcements/[id]` PATCH+DELETE | RLS | the intended editor job |
| `/api/players` GET+POST · `/api/players/[id]` GET+PATCH | service reads; RLS writes to `player` + `player_statistics` | players: create + edit (archive/restore stay admin) |
| `/api/teams/[id]/players` GET+POST · `…/players/[playerId]` DELETE | roster add via service; remove via RLS | add to / remove from a roster |
| `/api/teams` POST · `/api/teams/[id]` PATCH · `/api/teams/logo-upload` · `…/trim-logo` | RLS writes to `teams`; logos via service | teams: create + edit (archive/restore stay admin) |
| `POST /api/storage/signed-upload` (always under `players/`) · `POST …/delete-object` for `players/…` paths only | service | player photos |
| `PATCH /api/matches/[id]` — scores, status, teams, date, penalties | RLS | changes results and triggers progression |
| **`DELETE /api/matches/[id]`** | RLS | editors can delete matches; creating one is admin-only |
| `POST /api/matches/[id]/postpone` | RLS | |
| `saveAllStatsAction`, `updateMatchVideoAction` (`src/app/matches/[id]/actions.ts`) — the stats editor on the **public** match page, shown to anyone with `canEditContent` | RLS | |
| `POST /api/storage/article-img` | service | |
| `applySyncFix` (fix-stats), `runFullBackfill` (refresh-stats) | service | the pages are admin-only in the UI, the actions are editor-callable |

### Any logged-in account

`GET /api/matches/[id]/stats` (RLS-bound, so effectively staff),
`GET /api/storage/mask`, `GET /api/storage/player-img`, `GET /api/storage/proxy`
(image reads through the service role), `GET /api/me`.

### No check at all

| Surface | Problem |
|---|---|
| `addStageAction` — `src/app/tournaments/actions.ts` | `"use server"` + service role + **no auth**: inserts into `tournament_stages` for whoever calls it. Nothing imports it today (dead code, so not reachable from a client bundle) — delete it before it gets wired in. |
| `src/app/matches/[id]/queries.ts` | `'use server'` on a module of service-role **read** helpers makes each one a public server-action endpoint. Same fix already applied to the progression/stat modules: drop the directive (server components can import plain server-only functions). |

## 4. Layer 3 — Row Level Security (the boundary for direct database access)

The anon key ships in the browser. Anyone with a session can call PostgREST
directly, bypassing every check in §3 — RLS is what holds then.

| Tables | anon / no-role read | editor + admin | service role only |
|---|---|---|---|
| `matches`, `tournaments`, `tournament_stages`, `tournament_groups`, `tournament_teams`, `tournament_awards`, `stage_standings`, `teams`, `seasons` | read | | |
| `articles`, `announcements` | published only | read drafts, **write** | |
| `matches`, `match_player_stats`, `match_participants`, `player_statistics`, `tournament_awards`, `disciplinary_actions`, `tournaments`, `tournament_stages`, `tournament_groups`, `tournament_teams`, `stage_slots`, `intake_mappings`, `stage_standings`, `posts` | | **insert / update / delete** (`can_edit_content()`) | |
| `player`, `player_teams`, `player_*_stats`, `match_player_stats`, `match_participants`, `disciplinary_actions`, `season_team_adjustments`, `stage_slots`, `intake_mappings` | | read (`staff_read`) | |
| `player`, `teams` | | **insert / update** (`can_edit_content()`) — archiving is an UPDATE of `deleted_at`, so RLS cannot keep it admin-only; the API does | |
| `player_teams` | | **insert / delete** (`can_edit_content()`) | |
| `seasons`, `season_team_adjustments`, all stat caches, `audit_log` | | | **all writes** |

Source: `migrations/add-editor-role-rls.sql` + `migrations/enable-public-read-rls.sql`
+ `add-seasons.sql` + `migrations/add-editor-players-teams-rls.sql`. §3 of the
investigation script prints what is *actually* deployed; anything named
differently was created by hand in the dashboard (the admin-only write
policies on `player` / `teams` / `player_teams` are such hand-made ones).

## 5. Findings, most important first

1. **`addStageAction` has no auth** (service-role insert). Dead today; delete it.
2. **"Editor" means three different things.** UI: articles, announcements,
   players and teams (since 2026-09-15; the players/teams layers were aligned
   together — proxy, API, RLS). API: also edit *and delete* matches, postpone,
   rebuild stat caches. Database: also
   write `tournaments`, `tournament_stages`, `tournament_groups`, `tournament_teams`,
   `stage_slots`, `intake_mappings`, `stage_standings` directly. `add-editor-role-rls.sql`
   did this knowingly ("same RLS write access as admin"), but it is far wider than
   the dashboard suggests. Decide what an editor is, then make RLS and the API
   agree with it. Recommended: RLS = exactly what the API allows (content +
   match cluster), tournament structure admin-only.
3. **`/preview/tournament-builder` runs with its auth guard disabled** (comment says
   "TEMPORARY"), is linked from the admin nav, and lists tournaments through the
   service role. Its writes go through gated routes, so exposure is the UI plus
   tournament names. Restore the guard in its `layout.tsx` before onboarding.
4. **`queries.ts` is a `'use server'` module** exposing service-role reads (see §3).
5. ~~Role route has no self-protection~~ **Fixed 2026-09-14.** Role changes now
   follow three rules ([src/app/lib/roleChange.ts](../src/app/lib/roleChange.ts),
   unit-tested): only admins change roles; nobody changes their own; the last
   admin can never lose the role. A refusal sent from the users page comes back
   as a banner; every accepted change is written to the audit log with the
   before/after arrays. [migrations/add-admin-role-guards.sql](../migrations/add-admin-role-guards.sql)
   repeats the "last admin" rule inside Postgres so it also holds for edits made
   in Supabase Studio or the SQL editor. `app_metadata` is not writable by users
   themselves (Supabase reserves it for the service role), so there is no
   self-service path to a role.
6. **`ADMIN_EMAIL` fallback** grants dashboard pages (users list with every email,
   players, seasons…) to an account without the role. Remove it once the role is
   set, or keep it as a documented break-glass.
7. `DELETE /api/matches/[id]` is editor-allowed while `POST /api/matches` is
   admin-only — inconsistent; pick one.
8. `applySyncFix` / `runFullBackfill` are editor-callable although their pages are
   admin-only.
9. ~30 inline `roles.includes('admin')` checks instead of `requireAdmin()` /
   `requireEditor()` from `apiAuth.ts`. Not a bug, but every rule change must be
   copied 30 times. Consolidate when touching those files.
10. Leftovers: `lib/supabase/signDbToken.ts` (unused custom JWT signer with an
    `allowed: 'true'` claim — delete); `test_admin_role` RPC called from the
    browser in `MatchesDashboard.tsx` (read its body in §5b of the investigation,
    then drop both); `/api/me` on the legacy auth-helpers package;
    `ensureSameOrigin` in `announcements/[id]`, `articles`, `players` whitelists
    `req.url`'s origin, which the matches route deliberately avoids (Host header
    can be spoofed).
11. Sign-up is open. Accounts without a role are harmless, but if only staff ever
    log in, disable public sign-up in Supabase Auth and invite people instead.

## 6. Checklist before the new admins arrive

- [ ] Run `scripts/investigate-roles.sql`; confirm §1 lists exactly the people you expect.
- [ ] Run `migrations/add-audit-log.sql` and `migrations/add-admin-role-guards.sql`; deploy `feat/audit-log`; verify a saved match shows your email at `/dashboard/audit`.
- [ ] Know the handover rule: the last admin can never be demoted and nobody edits their own roles, so to step down another admin must exist and be the one to demote you. Granting is never blocked, so a single admin can onboard everyone else.
- [ ] Decide the editor definition (finding 2) and apply it in RLS + API.
- [ ] Fix findings 1, 3, 4.
- [ ] One account per person, roles granted from `/dashboard/users` (never share a login — the audit log names the account).
- [ ] The Supabase dashboard login stays with the owner; edits made there appear as `db_role = postgres` with no user.
- [ ] Never hand out the service-role key; it bypasses every layer above.
