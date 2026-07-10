# Review session prompts (sessions 5–9)

Companion to `docs/review-plan.md`. To run a session, start a fresh Claude Code session and paste:

> Read docs/review-prompts.md and execute Session N exactly as written.

Every session follows the same protocol:
- Create branch `review/0N-<slug>` from `main`; work only there.
- **Report findings first** with evidence (file:line, concrete failure scenario); do NOT fix
  anything until the user approves the findings list. Rank by impact.
- Findings that belong to another session's scope: append them under that session's entry in
  `docs/review-plan.md`, don't fix them here.
- After approval: one commit per logical fix, then `/code-review` on the diff before committing.
  Sessions 5 and 9 additionally run `/security-review`.
- Datetime rule (all sessions): all datetime display goes through `src/app/lib/datetime.ts`;
  match dates are literal wall-clock — never tz-convert them.

---

## Session 5 — Storage & images  [SECURITY]

Branch: `review/05-storage-images`

This is a security audit of every route that signs, uploads, serves, proxies, or deletes
storage objects, plus the front-end image resolution layer.

### Scope
- `src/app/api/storage/**/route.ts` — sign (there are TWO duplicate sign routes), signed-upload,
  article-img, tournaments/image-upload, tournament-img-loader, delete-object, player-img,
  mask, proxy, and the bare `api/storage/route.ts`
- `src/app/api/public/team-logo/[...path]/route.ts` (public CORS-open proxy)
- `src/app/api/teams/logo-upload/route.ts`, `src/app/api/teams/[id]/trim-logo/route.ts`
- `src/app/lib/image-config.ts`, `lib/OptimizedImage.tsx`, `lib/utils/images.ts`,
  `lib/player-images.ts` (deprecated), `src/app/lib/colorExtraction.ts`
- `src/app/tournaments/signTournamentLogos.ts`, `src/app/paiktes/SignedImg.tsx`

### What to look for
1. **Authorization matrix**: for every route — method, auth guard (none/session/editor/admin),
   which Supabase client (anon vs service-role), which bucket/path it can touch. Flag any
   mutation reachable without the right role and any signing endpoint that lets a low-priv
   user sign arbitrary paths.
2. **Path traversal & path control**: the `[...path]` catch-all, delete-object (can a caller
   delete ANY object by path?), signed-upload path construction (predictable/collidable paths,
   overwriting another entity's object, `../` segments, URL-encoded traversal).
3. **SSRF on the proxy route**: how the host allowlist is checked (exact host vs substring),
   whether redirects are followed after validation, internal-IP/metadata-endpoint reachability.
4. **Upload validation**: size limits enforced server-side (not just client), content-type
   verified vs trusted from the header, `sharp` processing untrusted input (decompression
   bombs), filename/extension sanitization.
5. **Caching semantics**: the public logo proxy serves immutable cache — what happens when a
   team replaces its logo (stale forever? cache-busting path?); signed-URL TTLs vs how long
   pages cache them.
6. **Consolidation targets**: the two duplicate sign routes → one; the bucket name
   `GPSarchive's Project` hardcoded in ~10 files → single source in image-config/env.

### Method
Produce the auth matrix as a table first (route → method → guard → client → path control →
verdict). For traversal/SSRF claims, show the exact payload that would get through. Test
locally with curl where possible rather than asserting from reading alone.

### Fix constraints
Security fixes first, consolidation second, in separate commits. Do not change stored paths
or URL formats already persisted in the DB (existing rows must keep resolving). Verify by
running the app and loading pages that render team logos, player photos, and article images.

---

## Session 6 — Player stats pipeline

Branch: `review/06-stats-pipeline`

Correctness audit of the stat aggregation layer: `match_player_stats` (source of truth) →
cache tables → leaderboards, plus a decision on the legacy dual-write table.

### Scope
- `src/app/lib/refreshPlayerStats.ts` (both `refreshStatsForMatch` and `refreshAllPlayerStats`)
- `src/app/dashboard/fix-stats/*` (drift detector), `src/app/dashboard/refresh-stats/*`
- How the writers invoke refresh: `src/app/matches/[id]/actions.ts` and
  `src/app/dashboard/tournaments/TournamentCURD/preview/actions.ts` — ONLY the refresh call
  sites; the save/progression path itself is Session 1's scope
- Readers: `src/app/paiktes/page.tsx`, `paiktes/types.ts` (`resolveStat`),
  `src/app/home/EditorialTopPlayersSection.tsx`, `src/components/cards/*`,
  tournament `PlayerStats.tsx`

### What to look for
1. **Aggregation correctness**: wins are attributed via `matches.winner_team_id` — check
   two-legged ties (winner is stamped on the decider; does the non-decider leg count a win?
   is anything double-counted?), forfeits, own goals, postponed-then-rescheduled matches,
   players who changed teams mid-season (primary team = appearance count — ties?).
2. **Incremental vs full-rebuild parity**: can `refreshStatsForMatch` drift from what
   `refreshAllPlayerStats` would compute? What happens when a finished match is REVERTED or
   its stats edited after finish — are caches decremented/recomputed or left stale?
3. **The legacy `player_statistics` table**: map every remaining reader and writer. Decide the
   canonical store and produce a concrete retirement plan (stop-write, migrate readers, drop) —
   as a plan in the findings, not an immediate deletion.
4. **Concurrency & partial failure**: 300-row chunked writes — two matches finalizing at once,
   failure mid-refresh (some chunks written), retries.
5. **The drift detector itself**: does fix-stats compare the right things, and does its
   apply-fix write the correct values?

### Deliverables
Findings list + a one-page retirement plan for `player_statistics`. Fixes limited to the
aggregation modules and the two dashboard tools; anything touching progression ordering goes
to Session 1's notes. Where aggregation math changes, add unit tests (vitest is set up —
`npm test`). Verify by running refresh-stats against dev data and diffing fix-stats output
before/after.

---

## Session 7 — Public read surfaces (perf & data access)

Branch: `review/07-public-read-surfaces`

Read-performance and data-access audit of the public-facing pages. Not a UI-tuning pass.

### Scope
Tournament viewer:
- `src/app/tournaments/loadTournamentIntoStore.tsx` (the "aggregate everything" loader)
- `src/app/tournaments/[id]/v2-dark/*` (TournamentClientV2Dark, KOBracketV2Dark, MobileShell)
- `src/app/tournaments/stages/*` (LeagueStage, GroupsStage, KnockoutStage, koStage/*)
- `src/app/tournaments/{page,TournamentsClient}.tsx`, `signTournamentLogos.ts`, `useTournamentData`

Match explorer & match page:
- `src/app/matches/page.tsx`, `MatchesExplorer.tsx`, `MatchesExplorerMobile.tsx`
- `src/app/matches/[id]/page.tsx`, `queries.ts`

Home:
- `src/app/page.tsx`, `src/app/home/data.ts`
- Async server sections: `home/HomeArticles.tsx`, `home/EditorialTopPlayersSection.tsx`
- Client refetchers: `home/EditorialCalendar.tsx` (`/api/matches/calendar`),
  `home/HomeVideos.tsx` (`/api/matches/videos`) — audit those two API routes too

Standings & team page:
- `src/app/standings/page.tsx`
- `src/app/OMADA/[id]/page.tsx` (aggregates season stats in JS from match_player_stats)

### What to look for
1. **Over-fetching**: `select('*')` or wide joins where the component renders 3 fields;
   loaders fetching all matches/players when the view paginates or windows; payload size of
   the tournament loader for a realistic tournament (16 teams, groups + KO, ~60 matches).
2. **N+1 and sequential awaits**: per-row queries in loops (logo signing is a suspect);
   awaits that could be `Promise.all`; the same table fetched twice in one request path.
3. **Browser-direct Supabase queries**: MatchesExplorer/MatchesExplorerMobile query Supabase
   from the client. Enumerate every table the anon key can read this way, check against RLS
   expectations, and flag anything readable that the UI doesn't need (also a security
   finding). Decide per case: keep (fine under RLS) vs move behind an API route.
4. **Caching correctness**: ISR windows (home 300s, matches 60s, match page uncached) vs how
   fresh each surface needs to be; missing revalidation after admin mutations; client refetch
   loops bypassing ISR. Note the known issue: `await headers()` in the root layout forces
   app-wide dynamic rendering, voiding page `revalidate` — verify and treat as a finding.
5. **Duplicated fetch logic**: home/data.ts vs `/preview/home-c`; matches/[id]/queries.ts vs
   other match fetchers; two standings systems (stage_standings vs teams.season_score) —
   flag confusion, do NOT unify the systems (out of scope).
6. **Render cost only where caused by data shape** (huge unfiltered arrays passed to client
   components). Pure UI render tuning is out of scope — /paiktes already had that pass.

### Method
For each page produce a table: route → queries it runs → rows/columns fetched → what's
rendered → verdict (ok / over-fetch / N+1 / move server-side). Quantify claims (row counts,
query counts per page load), not just "could be slow".

### Fix constraints
Don't change any page's visual output. Don't touch progression/save-all/generator code.
Verify with `npm run build` + loading /, /matches, /tournaments/[id], /standings, /OMADA/[id]
locally.

---

## Session 8 — Dashboard CRUD (teams / players / matches / users)

Branch: `review/08-dashboard-crud`

Correctness and authorization audit of the admin CRUD surfaces and their API routes.
The tournament wizard and progression engine are OUT of scope (Sessions 1–2 own those).

### Scope
- `src/app/dashboard/teams/*` (row editor, logo flow entry points, roster PlayersPanel,
  archive/restore; `AdminTeamsCRUD.tsx` is legacy — note, don't refactor)
- `src/app/dashboard/players/*` (drawer editor, board, filters)
- `src/app/dashboard/matches/*` (MatchesDashboard, RowEditor, PostponeDialog)
- `src/app/dashboard/users/*` (UsersTable role toggles)
- API routes: `src/app/api/teams*`, `src/app/api/players*`, the matches list/create/delete
  routes (NOT the PATCH progression internals), `src/app/api/admin/users/[id]/roles/route.ts`
- `src/app/dashboard/layout.tsx` + `ui/ClientShell.tsx` (the gate these all sit behind)

### What to look for
1. **Auth on every mutation route**: requireAdmin/requireEditor present and correct; editor
   role must NOT reach team/player/match/user mutations (content-only). Check the known
   same-origin inconsistency: some routes add the spoofable request origin to the allowlist —
   list every route doing this.
2. **Input validation**: create/edit payloads (missing fields, numeric coercion, negative
   scores, absurd dates), server-side vs client-only validation.
3. **Delete/archive semantics**: teams and players use soft delete — is it consistent? What
   happens deleting a team that has matches / a player with stat rows? Orphan risk.
4. **Match RowEditor winner logic**: cross-check the two-legged-aware winner computation
   against the engine's rule (winner on LEG WINS, not aggregate; penalties on the decider).
   Known gap to confirm and scope: PATCH rejects entering a drawn single-leg KO match that
   should go to penalties.
5. **Role management**: can an admin revoke their own admin role / the last admin? Can the
   roles payload inject arbitrary roles? Is the target user validated?
6. **UI state after mutations**: stale lists, optimistic updates without rollback on error,
   pagination/filter state surviving edits.

### Method
Auth matrix first (route → method → guard → origin check → verdict), then per-section
functional findings. For the winner-logic check, write out the truth table (leg scores →
expected winner) and compare both implementations against it.

### Fix constraints
Progression engine findings go to Session 1's notes. Role/route auth fixes first. Verify by
exercising each CRUD flow in the dashboard locally (create, edit, archive, restore, delete)
and `npm test`.

---

## Session 9 — Content & CMS  [XSS SURFACE]

Branch: `review/09-content-cms`

Security-focused audit of user-authored content: every path from an editor's input to
rendered HTML in a public or admin page, plus content API authorization.

### Scope
- `src/app/api/articles/**`, `api/articles-public/**`, `api/announcements/**` (all methods)
- `src/app/article/[slug]/page.tsx` — TipTap JSON → HTML conversion server-side
- `src/app/announcement/[id]/page.tsx`, `src/app/articles/page.tsx` (unified hub),
  `src/app/anakoinoseis/page.tsx` (legacy redirect)
- `src/components/AnnouncementContent.tsx` (renders md / html / plain bodies),
  `src/components/{ArticlePreview,RelatedArticles,ArticleNavigation,RichTextEditor}.tsx`
- `src/app/dashboard/articles/ArticlesAdmin.tsx`, `dashboard/announcements/AnnouncementsAdmin.tsx`
- `src/app/home/HomeArticles.tsx`, `src/app/lib/fetchRecentNewsCount.ts`,
  `src/lib/articleUtils.ts`, `src/app/sitemap.ts` (draft leakage check)
- `src/app/api/matches/[id]/postpone/route.ts` — ONLY the announcement side-effect it writes

### What to look for
1. **XSS sinks**: find every `dangerouslySetInnerHTML` and server-side HTML string assembly
   in scope. For each: what content type flows in (TipTap JSON→HTML, raw html announcement
   body, markdown), and is there sanitization (DOMPurify/allowlist) at write OR render time?
   Note: authors are editor-role users, but stored XSS from an editor account still owns
   admin sessions viewing the content — treat unsanitized editor input as a real finding.
   Check what the TipTap→HTML converter does with link hrefs (`javascript:` URLs) and
   embedded iframes/attrs.
2. **Draft/visibility gating on EVERY read path**: article by slug (drafts to editors only),
   related articles, prev/next navigation, the hub API (`articles-public` leaking drafts or
   archived?), sitemap.ts, view counts, navbar recent-news count, announcement visibility
   window (`starts_at`/`ends_at` enforced server-side, not just in UI?).
3. **API authorization**: create/edit/delete gated to editor/admin; object-level checks
   (can editor A edit editor B's draft — intended?); the postpone side-effect writing
   announcements with the right shape.
4. **Slug handling**: slug collision/uniqueness, slug used in queries safely, redirect
   behavior on slug change.
5. **Loose ends**: `increment_article_view_count` RPC defined but apparently unwired — dead
   or missing feature; view_count writes on cached pages.

### Method
Trace table first: content field → where authored → where stored → every render sink →
sanitizer present? → verdict. Then attempt a concrete payload for each claimed XSS (e.g. an
announcement body with `<img onerror>`) against a local dev run — confirmed beats plausible.
Note the CSP nonce setup in src/proxy.ts and say per finding whether CSP actually blocks it.

### Fix constraints
Sanitize consistently at render time (one shared sanitizer module), don't strip legitimate
formatting the CMS produces today — diff rendered output for existing articles before/after.
Draft-gating fixes must not break editor preview. Finish with `/security-review` +
`/code-review`. Verify locally: author an article + announcement in the dashboard, view as
anonymous, editor, admin.
