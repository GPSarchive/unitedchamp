# Routes catalog

Every URL the user can hit. Grouped by audience. See [00-overview.md](00-overview.md) for vocabulary.

Conventions: paths are relative to `src/`. ISR / SSR hints appear in the **Cache** column. **Auth** notes anything beyond "public."

---

## Root layout

| Path | File | Notes |
|---|---|---|
| `(all routes)` | [app/layout.tsx](../../src/app/layout.tsx) | Greek lang, fonts (Geist, Roboto Condensed, Ubuntu Condensed, Noto Sans), CSP nonce via `headers()`, wraps in `ConsentProvider` → Navbar → main → Footer → ConsentGatedAnalytics → CookieBanner. |
| `(global error)` | [app/global-error.tsx](../../src/app/global-error.tsx), [app/error.tsx](../../src/error.tsx) | App-level error boundaries. |
| `(not found)` | [app/not-found.tsx](../../src/app/not-found.tsx) | 404. |
| `(head/icon)` | [app/head.tsx](../../src/app/head.tsx), [app/icon.png](../../src/app/icon.png) | Per-route head + favicon. |
| `/sitemap.xml` | [app/sitemap.ts](../../src/app/sitemap.ts) | Generated sitemap. |

---

## Public site

### Home & marketing

| URL | File | Cache | Notes |
|---|---|---|---|
| `/` | [app/page.tsx](../../src/app/page.tsx) | `revalidate: 300` | UltraChamp editorial home. Fetches matches (-60d / +90d window), tournaments (limit 6), recent news count, video matches. Hero carousel + dashboard + calendar + articles + videos + top players + tournaments CTA + testimonials. **All four data fetchers are duplicated in `preview/home-c/page.tsx`** — flag as cleanup. |
| `/home` | [app/home/page.tsx](../../src/app/home/page.tsx) | static | Redirect → `/`. |
| `/hometest` | [app/hometest/page.tsx](../../src/app/hometest/page.tsx) | — | Older home variant: fetches single user + matches with verbose logging via `withConsoleTiming`. **Looks like dead/abandoned scaffolding** — flag as candidate dead end. |
| `/hometest/home` | [app/hometest/home/page.tsx](../../src/app/hometest/home/page.tsx) | static | Redirect → `/`. |
| `/preview/home-c` | [app/preview/home-c/page.tsx](../../src/app/preview/home-c/page.tsx) | `revalidate: 300` | "Option C" preview — same fetchers as `/` but uses `TeamDashboard` + `EnhancedMobileCalendar` + `TopPlayersSection` + `RecentAnnouncementsBubble` instead of the `Editorial*` variants. Honored by [auto-memory preference](../../.claude/projects/c--Users-nader-unitedchamp-unitedchamp/memory/feedback_preview_routes.md): preview routes stay live; don't overwrite. |

### Content (articles + announcements)

| URL | File | Cache | Notes |
|---|---|---|---|
| `/articles` | [app/articles/page.tsx](../../src/app/articles/page.tsx) | RCC | Client component. Fetches `/api/articles-public`, merges with announcements, extracts first image from TipTap JSON. Filter all / articles / announcements. |
| `/article/[slug]` | [app/article/[slug]/page.tsx](../../src/app/article/[slug]/page.tsx) | RSC | Reads via `createSupabaseRSCClient` (RLS-aware). Drafts gated behind admin role. Renders TipTap JSON → HTML server-side. Sibling components: `RelatedArticles`, `ArticleNavigation`. |
| `/anakoinoseis` (announcements) | [app/anakoinoseis/page.tsx](../../src/app/anakoinoseis/page.tsx) | static | Redirect → `/articles`. Legacy URL kept for backlinks. |
| `/announcement/[id]` | [app/announcement/[id]/page.tsx](../../src/app/announcement/[id]/page.tsx) | RSC | Numeric ID; gated to `status = 'published'`. Renders `AnnouncementContent` (markdown/html/plain). |

### Teams, players, tournaments, matches

| URL | File | Cache | Notes |
|---|---|---|---|
| `/OMADES` (teams) | [app/OMADES/page.tsx](../../src/app/OMADES/page.tsx) | RSC | Paginated team listing (16/page). Fuzzy search via `search_teams_fuzzy` RPC; default sort by name; filters `deleted_at IS NULL`. Editorial paper background. |
| `/OMADA/[id]` (team detail) | [app/OMADA/[id]/page.tsx](../../src/app/OMADA/[id]/page.tsx) | RSC | Loads team, tournament memberships (de-duped), championships won, players via `player_teams` + latest `player_statistics`, season stats aggregated from `match_player_stats` for finished matches, full match history. Hands off to `TeamClient`. |
| `/paiktes` (players) | [app/paiktes/page.tsx](../../src/app/paiktes/page.tsx) | `revalidate: 300` | Reads from precomputed `player_career_stats` / `player_tournament_stats`. Batched fetches (300/chunk). Search params: `sort`, `tournament_id`, `top`, `page`, `q`. |
| `/tournaments` | [app/tournaments/page.tsx](../../src/app/tournaments/page.tsx) | RSC | All tournaments with `winner_team` join. Signs logos via `signTournamentLogos`. |
| `/tournaments/[id]` | [app/tournaments/[id]/page.tsx](../../src/app/tournaments/[id]/page.tsx) | RSC | Loads tournament via `loadTournamentIntoStore`, signs logo, renders `TournamentClientV2Dark`. **Identical to `/v2-dark` variant** — flag for review. |
| `/tournaments/[id]/v2` | [app/tournaments/[id]/v2/page.tsx](../../src/app/tournaments/[id]/v2/page.tsx) | RSC | Same loader, light theme (`TournamentClientV2`). |
| `/tournaments/[id]/v2-dark` | [app/tournaments/[id]/v2-dark/page.tsx](../../src/app/tournaments/[id]/v2-dark/page.tsx) | RSC | Same loader, dark theme (`TournamentClientV2Dark`). The canonical `/tournaments/[id]` now points here. |
| `/matches` | [app/matches/page.tsx](../../src/app/matches/page.tsx) | `revalidate: 60` | Fetches tournament list for filter dropdown, renders `MatchesExplorer`. |
| `/matches/[id]` | [app/matches/[id]/page.tsx](../../src/app/matches/[id]/page.tsx) | `revalidate: 0` | Detailed match page with stats editor (admin), video form (admin), events timeline, rosters, standings. Admin role unlocks `MatchAdminActions`. Search param `?video=` to show video. |
| `/standings` | [app/standings/page.tsx](../../src/app/standings/page.tsx) | `revalidate: 60` | Global standings using `teams.season_score`. Optional `?season=` query (display-only, no filtering). Hardcoded prize table for places 1–3. |

### Auth flow

| URL | File | Cache | Notes |
|---|---|---|---|
| `/login` | [app/login/page.tsx](../../src/app/login/page.tsx) | RCC | Posts to `/api/auth/sign-in`. Pulls CSRF from `/api/auth/csrf`. Optional `?bg=` theme switcher (track/court/stadium/soccer/cycling/tennis — Unsplash URLs hardcoded). OAuth Google via `/api/auth/oauth?provider=google`. `?next=` for post-login redirect. |
| `/sign-up` | [app/sign-up/page.tsx](../../src/app/sign-up/page.tsx) | RCC | Posts to `/api/auth/sign-up`. CSRF + password rules client-side. |
| `/check-email` | [app/check-email/page.tsx](../../src/app/check-email/page.tsx) | RSC | Reads `__pending_email` cookie, falls back to `?email=` param. Hands off to `CheckEmailContent`. |

### Static / informational

| URL | File | Notes |
|---|---|---|
| `/epikoinonia` (contact) | [app/epikoinonia/page.tsx](../../src/app/epikoinonia/page.tsx) | Contact form, address, phone, email, social links, OpenStreetMap embed. |
| `/kanonismos` (rules) | [app/kanonismos/page.tsx](../../src/app/kanonismos/page.tsx) | 49 hardcoded rules (5x5/6x6/7x7 mini-football regulation). |
| `/cookies` | [app/cookies/page.tsx](../../src/app/cookies/page.tsx) | Cookie policy. |
| `/privacy` | [app/privacy/page.tsx](../../src/app/privacy/page.tsx) | Privacy policy. |
| `/terms` | [app/terms/page.tsx](../../src/app/terms/page.tsx) | Terms of service. |

### Demo / scratch routes

| URL | File | Notes |
|---|---|---|
| `/waves` | [app/waves/page.tsx](../../src/app/waves/page.tsx) | Standalone demo of `waves` component. Almost certainly a sandbox. **Flag as dead end candidate.** |
| `/dotgrid` | [app/dotgrid/page.tsx](../../src/app/dotgrid/page.tsx) | Standalone demo of `DotGrid` component. **Flag as dead end candidate.** |

---

## Admin / dashboard

Layout: [app/dashboard/layout.tsx](../../src/app/dashboard/layout.tsx) — `dynamic = "force-dynamic"`, redirects to `/login?next=/dashboard` if unauthenticated, redirects to `/403` if not `admin`. Wraps in `ClientShell`.

| URL | File | Notes |
|---|---|---|
| `/dashboard` | [app/dashboard/page.tsx](../../src/app/dashboard/page.tsx) | Card grid linking to subsections. |
| `/dashboard/users` | [app/dashboard/users/page.tsx](../../src/app/dashboard/users/page.tsx) | Paginated user search by email. `UsersTable`. |
| `/dashboard/teams` | [app/dashboard/teams/page.tsx](../../src/app/dashboard/teams/page.tsx) | All teams (including soft-deleted, since no `deleted_at IS NULL` filter — confirm intent). Signs logos with 24h URLs. `AdminTeamsGridClient`. |
| `/dashboard/players` | [app/dashboard/players/page.tsx](../../src/app/dashboard/players/page.tsx) | `AdminPlayersCRUD`. |
| `/dashboard/matches` | [app/dashboard/matches/page.tsx](../../src/app/dashboard/matches/page.tsx) | Matches with team/tournament/stage/group joins. Optional `?tid=` filter. `MatchesDashboard`. |
| `/dashboard/tournaments` | [app/dashboard/tournaments/page.tsx](../../src/app/dashboard/tournaments/page.tsx) | Tournament list + editor wizard inline if `?tid=` set. Calls `getTournamentForEditAction` server action. |
| `/dashboard/tournaments/TournamentCURD/edit/[id]` | [app/dashboard/tournaments/TournamentCURD/edit/[id]/page.tsx](../../src/app/dashboard/tournaments/TournamentCURD/edit/[id]/page.tsx) | Standalone edit page for a tournament. Same wizard. Note: folder spelled `TournamentCURD` (sic — likely meant `CRUD`). |
| `/dashboard/announcements` | [app/dashboard/announcements/page.tsx](../../src/app/dashboard/announcements/page.tsx) | `AnnouncementsAdmin`. |
| `/dashboard/articles` | [app/dashboard/articles/page.tsx](../../src/app/dashboard/articles/page.tsx) | `ArticlesAdmin`. |
| `/dashboard/fix-stats` | [app/dashboard/fix-stats/page.tsx](../../src/app/dashboard/fix-stats/page.tsx) | Diff tool: compares `player_statistics` vs recomputed totals from `match_player_stats`. One-shot drift detector. |
| `/dashboard/refresh-stats` | [app/dashboard/refresh-stats/page.tsx](../../src/app/dashboard/refresh-stats/page.tsx) | Backfill button for `player_career_stats` + `player_tournament_stats`. Shows source row count + top-10 preview. |

---

## Surfaced for follow-up

Already worth noting before we move to the API catalog:

1. **Duplicated home logic** — `/` and `/preview/home-c` share ~200 lines of identical fetchers + date helpers. A shared module in `app/home/` would reduce drift risk.
2. **Likely dead pages** — `/hometest`, `/hometest/home`, `/waves`, `/dotgrid`. None are linked from Navbar or Footer (to verify when we map shared UI).
3. **Redundant tournament route variants** — `/tournaments/[id]` and `/tournaments/[id]/v2-dark` render identical client components from the same loader. `/v2` is the only divergent one (light theme).
4. **Hardcoded content** in `/standings` (prize table) and `/kanonismos` (49 rules). Worth flagging if these need CMS-ification.
5. **Misspelled folder** — `TournamentCURD` under dashboard. Cosmetic but inconsistent with `CRUD` everywhere else.
6. **Soft-delete inconsistency** — `/OMADES` filters `deleted_at IS NULL`; `/dashboard/teams` does not. Confirm whether admin view should show archived teams.

These will land in [dead-ends.md](dead-ends.md) and [cleanup-candidates.md](cleanup-candidates.md) once those files exist.
