# API endpoints catalog

50 route handlers under `src/app/api/`. Grouped by resource. See [00-overview.md](00-overview.md) for vocabulary.

## Legend

- **Auth**: `public` (no check) · `user` (logged in) · `admin` (role `admin` in `app_metadata.roles`) · `csrf` (validates `_csrf` form field) · `same-origin` (Origin/Referer must match `ALLOWED_ORIGINS` env)
- **Client**: which Supabase client is used. `route-client` = cookie-bound (RLS enforced). `admin` = service role (bypasses RLS).
- HEAD/OPTIONS handlers are present on most non-auth routes; omitted from tables for brevity.

---

## Auth flow

Pattern: form-posted sign-in/up validates CSRF + applies per-email rate limit, then redirects. OAuth uses Supabase + a hardcoded production callback URL.

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/auth/csrf` | GET | public | Mints CSRF token via `generateCsrfToken`. | [route.ts](../../src/app/api/auth/csrf/route.ts) |
| `/api/auth/sign-in` | POST | csrf | Form-posted. Per-email rate limit 5/15min. Redirects to `safeNextUrl` on success, back to `/login?error=...` on failure. | [route.ts](../../src/app/api/auth/sign-in/route.ts) |
| `/api/auth/sign-up` | POST | csrf | Form-posted. Password rules via `validatePassword`. Sets `__pending_email` cookie. | [route.ts](../../src/app/api/auth/sign-up/route.ts) |
| `/api/auth/sign-out` | POST, GET | user | Calls `supabase.auth.signOut()` then redirects to `/login`. GET delegates to POST. | [route.ts](../../src/app/api/auth/sign-out/route.ts) |
| `/api/auth/refresh` | POST | user | `refreshSession()`. Returns 204. | [route.ts](../../src/app/api/auth/refresh/route.ts) |
| `/api/auth/oauth` | GET | public | Initiates OAuth (`google` or `github`). **Hardcodes `BASE_URL = 'https://unitedchamp.vercel.app'`** — flag as cleanup. | [route.ts](../../src/app/api/auth/oauth/route.ts) |
| `/api/auth/callback` | GET | public | Exchanges `?code` for session. Redirects to `safeNextUrl` (default `/dashboard`). | [route.ts](../../src/app/api/auth/callback/route.ts) |
| `/api/auth/confirm` | GET | public | Handles email-link flows: signup/recovery/email_change/magiclink/invite. Accepts `code` or `token_hash` + `type`. | [route.ts](../../src/app/api/auth/confirm/route.ts) |
| `/api/auth/resend` | POST | csrf | Per-email resend rate limit 3/hour. Sets `__pending_email` cookie. | [route.ts](../../src/app/api/auth/resend/route.ts) |

## Current user

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/me` | GET | user | Returns `{ user }`. **Uses legacy `@supabase/auth-helpers-nextjs` `createRouteHandlerClient`** — the rest of the codebase uses `@supabase/ssr` via `createSupabaseRouteClient`. Flag as cleanup. | [route.ts](../../src/app/api/me/route.ts) |

## Admin operations

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/admin/users/[id]/roles` | POST | admin | Toggle `admin` role on a user. Accepts JSON (`{admin: bool}`) or form (`admin` checkbox). Form path redirects to `returnTo`. Uses `supabaseAdmin.auth.admin.updateUserById`. | [route.ts](../../src/app/api/admin/users/[id]/roles/route.ts) |
| `/api/debug/invocations` | GET | admin | Diagnostic stub — returns hints for checking Vercel function invocations. **Marked "Temporary debug endpoint" in code.** Flag as cleanup candidate. | [route.ts](../../src/app/api/debug/invocations/route.ts) |

---

## Articles & announcements

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/articles` | GET, POST | admin | List with admin gating; create. Touches `articles`. | [route.ts](../../src/app/api/articles/route.ts) |
| `/api/articles/[id]` | GET, PATCH, DELETE | admin | Full CRUD by numeric id. | [route.ts](../../src/app/api/articles/[id]/route.ts) |
| `/api/articles/slug/[slug]` | GET | public-ish | Public read by slug; drafts filtered. | [route.ts](../../src/app/api/articles/slug/[slug]/route.ts) |
| `/api/articles-public` | GET | public | Lists published articles. **Has a fallback path for missing `view_count`/`featured_image` columns** — schema-drift defensive code. Flag for cleanup once schema is stable. | [route.ts](../../src/app/api/articles-public/route.ts) |
| `/api/announcements` | GET, POST | mixed | List public + admin create. Touches `announcements`. | [route.ts](../../src/app/api/announcements/route.ts) |
| `/api/announcements/[id]` | PATCH, DELETE | admin | Edit/delete one announcement. | [route.ts](../../src/app/api/announcements/[id]/route.ts) |

## Matches

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/matches` | POST | admin + same-origin | Insert match. Field allow-list enforced (`INSERTABLE_FIELDS`); `status` constrained to `scheduled`/`finished`. Touches `matches`, reads `tournament_stages`. | [route.ts](../../src/app/api/matches/route.ts) |
| `/api/matches/[id]` | PATCH | admin + same-origin | Update non-structural fields only (no `round`/`bracket_pos`/source fields — use reseed). Imports `progressAfterMatch` from dashboard module to run progression after a match finishes. Touches `matches`, `tournament_stages`. | [route.ts](../../src/app/api/matches/[id]/route.ts) |
| `/api/matches/[id]/stats` | GET | user | Returns `match_player_stats` for a match. Cookie-bound (RLS). | [route.ts](../../src/app/api/matches/[id]/stats/route.ts) |
| `/api/matches/[id]/postpone` | POST | admin + same-origin | Postpones a match; writes new date + creates an announcement row. Imports postponement helpers; touches `matches`, `announcements`. | [route.ts](../../src/app/api/matches/[id]/postpone/route.ts) |
| `/api/matches/calendar` | GET | public | `?after=&before=` window query for the calendar widget. Default: -60d to +90d. Limit 200. | [route.ts](../../src/app/api/matches/calendar/route.ts) |
| `/api/matches/videos` | GET | public | Cursor-paginated (10/page) — newest first. Cursor: `(match_date, id)`. Filters `video_url IS NOT NULL`. | [route.ts](../../src/app/api/matches/videos/route.ts) |

## Tournaments & stages

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/tournaments` | GET | public | List with `?status=&limit=` filters. | [route.ts](../../src/app/api/tournaments/route.ts) |
| `/api/tournaments/[id]/snapshot` | GET | admin | Full editor snapshot — joins tournaments + stages + groups + matches + tournament_teams + stage_slots + intake_mappings + stage_standings + teams. Returns `FullTournamentSnapshot` (imported from dashboard store). `dynamic = "force-dynamic"`. | [route.ts](../../src/app/api/tournaments/[id]/snapshot/route.ts) |
| `/api/tournaments/[id]/save-all` | POST | admin (uses `supabaseAdmin`) | Massive editor save. Touches `tournaments`, `tournament_groups`, `tournament_stages`, `tournament_teams`, `stage_slots`, `intake_mappings`, `matches`. ~700 lines — flag as the single largest mutation endpoint. | [route.ts](../../src/app/api/tournaments/[id]/save-all/route.ts) |
| `/api/tournoua/[id]/matches` | GET | user (route-client) | Lists matches for a tournament (tree-friendly columns: stage/group/round/bracket_pos/source IDs). **Note: `tournoua` is a separate folder from `tournaments` — Greek transliteration. Confirm whether both should exist or one should redirect.** | [route.ts](../../src/app/api/tournoua/[id]/matches/route.ts) |
| `/api/stages/[id]/standings` | GET | public (service role) | Reads `stage_standings`. Uses raw `createClient` with service role (not `supabaseAdmin` import) — minor inconsistency. | [route.ts](../../src/app/api/stages/[id]/standings/route.ts) |
| `/api/stages/[id]/reseed` | POST | admin | Recomputes standings + rebuilds KO bracket pairings for a stage. Touches `stage_standings`, `tournament_stages`, `matches`. Uses service role. | [route.ts](../../src/app/api/stages/[id]/reseed/route.ts) |

## Teams

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/teams` | GET, POST | mixed | List teams (public) / create (admin). | [route.ts](../../src/app/api/teams/route.ts) |
| `/api/teams/[id]` | GET, PATCH, DELETE | mixed | Single team CRUD. DELETE soft-deletes (sets `deleted_at`). | [route.ts](../../src/app/api/teams/[id]/route.ts) |
| `/api/teams/[id]/restore` | POST | admin | Reverses soft delete. | [route.ts](../../src/app/api/teams/[id]/restore/route.ts) |
| `/api/teams/[id]/players` | GET, POST | mixed | List players on a team / add a player association (`player_teams`). Touches `player`, `player_statistics`, `player_teams`. | [route.ts](../../src/app/api/teams/[id]/players/route.ts) |
| `/api/teams/[id]/players/[playerId]` | DELETE | admin | Remove a player from a team. | [route.ts](../../src/app/api/teams/[id]/players/[playerId]/route.ts) |
| `/api/teams/logo-upload` | POST | admin | multipart form. Max 3MB, image-only. Stores at `<slug>/<uuid>.<ext>` under `GPSarchive's Project` bucket. Returns proxy URL via `/api/public/team-logo/...`. | [route.ts](../../src/app/api/teams/logo-upload/route.ts) |
| `/api/teams/[id]/trim-logo` | POST | admin | Downloads existing team logo, uses `sharp` to trim transparent borders, re-uploads. | [route.ts](../../src/app/api/teams/[id]/trim-logo/route.ts) |

## Players

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/players` | GET, POST | mixed | List / create. Touches `player`, `player_teams`, `player_statistics`. | [route.ts](../../src/app/api/players/route.ts) |
| `/api/players/[id]` | GET, PATCH, DELETE | mixed | Single player CRUD. DELETE may hard-delete via `supabaseAdmin.from("player").delete()`. | [route.ts](../../src/app/api/players/[id]/route.ts) |
| `/api/players/[id]/restore` | POST | admin | Reverses soft delete. | [route.ts](../../src/app/api/players/[id]/restore/route.ts) |

## Storage / image pipeline

The bucket `GPSarchive's Project` is the dominant store — note the literal space in the name. Sanity check that the bucket exists with that exact label.

| URL | Method | Auth | Notes | File |
|---|---|---|---|---|
| `/api/public/team-logo/[...path]` | GET | public | Proxy that downloads from the private bucket and re-serves. Path validation rejects `..` and leading `/`. CORS open. | [route.ts](../../src/app/api/public/team-logo/[...path]/route.ts) |
| `/api/storage` | GET | admin | Creates a 1h signed URL. **Duplicate of `/api/storage/sign` — identical implementation.** Flag as cleanup. | [route.ts](../../src/app/api/storage/route.ts) |
| `/api/storage/sign` | GET | admin | Creates a 1h signed URL. **Duplicate of `/api/storage`.** | [route.ts](../../src/app/api/storage/sign/route.ts) |
| `/api/storage/signed-upload` | POST | admin | Creates a presigned upload URL into `GPSarchive's Project` bucket. Slugifies `dirName`. | [route.ts](../../src/app/api/storage/signed-upload/route.ts) |
| `/api/storage/delete-object` | POST | admin | Deletes a bucket object. | [route.ts](../../src/app/api/storage/delete-object/route.ts) |
| `/api/storage/article-img` | POST | admin | Mints presigned upload URL for article images. | [route.ts](../../src/app/api/storage/article-img/route.ts) |
| `/api/storage/player-img` | GET | user | Proxies player photos out of the private `players` bucket (`NEXT_PUBLIC_PLAYER_PHOTO_BUCKET`). | [route.ts](../../src/app/api/storage/player-img/route.ts) |
| `/api/storage/mask` | GET | user | Proxies SVG/PNG masks from `assets/masks/`. Path constrained by `ALLOWED_PREFIX = /^masks\//`. | [route.ts](../../src/app/api/storage/mask/route.ts) |
| `/api/storage/proxy` | GET | user | SSRF-safe image proxy: only forwards HTTPS URLs whose hostname matches Supabase URL or `NEXT_PUBLIC_CDN_DOMAIN`. | [route.ts](../../src/app/api/storage/proxy/route.ts) |
| `/api/storage/tournament-img-loader` | GET | user | Resolves tournament image references → public or signed URLs. Hardcoded bucket `GPSarchive's Project`. | [route.ts](../../src/app/api/storage/tournament-img-loader/route.ts) |
| `/api/storage/tournaments/image-upload` | POST | admin | Presigned upload for tournament logos/banners. Slug + `kind` (logos/banners) folder structure. | [route.ts](../../src/app/api/storage/tournaments/image-upload/route.ts) |

---

## Cross-cutting notes (surface area for cleanup)

1. **Two duplicate signed-URL endpoints** — `/api/storage` and `/api/storage/sign` have byte-identical implementations. One should be removed.
2. **`tournaments` vs `tournoua` naming split** — REST routes live at `/api/tournaments/...` but `/api/tournoua/[id]/matches` exists alone in the `tournoua` folder. Consolidate.
3. **Bucket name with a literal space**: `"GPSarchive's Project"` is hardcoded across 7+ endpoints. One env var with a sensible default would make this safer.
4. **Two Supabase client styles in use**:
   - Modern: `createSupabaseRouteClient` from `@/app/lib/supabase/supabaseServer` (used by 90% of routes)
   - Legacy: `createRouteHandlerClient` from `@supabase/auth-helpers-nextjs` (only in `/api/me`)
   - Several routes inline their own `getServerSupabase` + `requireAdmin` helpers instead of importing from `@/app/lib/supabase/apiAuth` (signed-upload, article-img, delete-object, tournaments/image-upload, tournament-img-loader). Consolidate.
5. **Hardcoded production URL** in `/api/auth/oauth` (`BASE_URL = 'https://unitedchamp.vercel.app'`). Should come from env.
6. **`/api/debug/invocations`** is marked as a temporary debug endpoint in code.
7. **`/api/articles-public`** has a defensive fallback for missing `view_count`/`featured_image` columns — once migrations confirm those columns exist everywhere, the fallback can be deleted.
8. **`/api/matches/[id]` imports from `dashboard/tournaments/TournamentCURD/progression`** — API depending on a dashboard module is a layering inversion. The progression logic likely belongs in `lib/`.
9. **`/api/tournaments/[id]/snapshot`** imports `FullTournamentSnapshot` type from `dashboard/.../tournamentStore` — same layering concern.
10. **`/api/teams/[id]/trim-logo` uses `sharp`** — heavy native dep. Worth knowing for deploy/runtime size.

These will go into [cleanup-candidates.md](cleanup-candidates.md) when I write that file.
