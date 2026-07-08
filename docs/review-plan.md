# Code Review Plan — one pipeline per session

How to use: start a fresh Claude Code session per item, on a fresh branch cut from `main`
(e.g. `review/01-progression`). Paste: *"Read docs/review-plan.md, do session N. Review the
listed files for the stated focus, report findings first, then fix the confirmed ones.
Run /code-review on the diff before committing."* One PR per session.

Ordered by risk (data integrity → security → correctness → cleanup).

---

## Session 1 — Progression engine & match finalization  [HIGHEST RISK]
The cascade that runs when a match finishes. Many sequential writes, no transaction (known issue).
- `src/app/dashboard/tournaments/TournamentCURD/progression.ts`
- `src/app/dashboard/tournaments/TournamentCURD/util/functions/twoLeggedTie.ts`
- `src/app/api/matches/[id]/route.ts` (+ `postpone/`)
- `src/app/matches/[id]/actions.ts`
- `src/app/dashboard/tournaments/TournamentCURD/preview/actions.ts` (saveMatchStats / revert / forfeit)
- `src/app/lib/refreshPlayerStats.ts`

Focus: partial-failure recovery, idempotency (progression re-run on same match), two-legged
decider edge cases (leg 1 finishing after leg 2, penalties on level ties), winner stamping,
"never overwrite finished/manual slots" guarantee, revert/forfeit undo paths.

## Session 2 — Tournament save path (save-all + editor store)
The single biggest mutation surface (~700-line route + ~2,100-line store).
- `src/app/api/tournaments/[id]/save-all/route.ts`
- `src/app/api/tournaments/[id]/snapshot/route.ts`
- `src/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore.ts`
- `src/app/dashboard/tournaments/TournamentCURD/submit/{ReviewAndSubmit,loadSnapshotClient}.tsx/.ts`
- `src/app/dashboard/tournaments/TournamentCURD/actions.ts`

Focus: leg-aware match dedupe, temp-id→db-id mapping, KO id-resolution pass
(`source_match_id`, `tie_leg1_match_id`), optimistic locking on stage_slots (409 path),
group_id-null orphan regressions (recently fixed — verify all paths), delete ordering.

## Session 3 — Fixture generators & bracket math  [PURE FUNCTIONS — ADD TESTS]
- `src/app/dashboard/tournaments/TournamentCURD/util/Generators.ts`
- `src/app/dashboard/tournaments/TournamentCURD/util/functions/*.ts`
  (roundRobin, knockoutAnyN, knockoutPowerOfTwo, twoLeggedTie, groupsIntake, common)
- `src/app/dashboard/tournaments/TournamentCURD/util/groupsSignature.ts`
- `src/app/lib/utils/bracket.ts`, `src/app/lib/utils/standings.ts`

Focus: odd team counts, byes, seeding order, two-leg expansion (home/away swap),
intake normalization, tiebreaker chain (points/GD/GF/H2H/fair-play). These are pure —
the fix deliverable should include unit tests.

## Session 4 — Auth & authorization  [SECURITY]
- `src/proxy.ts` (middleware: rate limit, CSP, auth gate)
- `src/app/api/auth/*/route.ts` (csrf, sign-in/up/out, oauth, callback, confirm, refresh, resend)
- `src/app/lib/{csrf,safe-redirect,password-validation,rate-limit}.ts`
- `src/app/lib/supabase/apiAuth.ts` + all client variants in `lib/supabase/`
- `src/app/api/admin/users/[id]/roles/route.ts`, `src/app/dashboard/layout.tsx`

Focus: known same-origin inconsistency (team/player/content routes trust spoofable request
origin; match routes strict — unify), rate limiter fails open, editor-vs-admin gating
completeness, safe-redirect coverage, legacy clients (`client.ts`, `supabaseClient.ts`,
`/api/me`). Finish with /security-review.

## Session 5 — Storage & images  [SECURITY]
- `src/app/api/storage/**/route.ts` (sign ×2 duplicates, signed-upload, article-img,
  tournaments/image-upload, delete-object, player-img, mask, proxy)
- `src/app/api/public/team-logo/[...path]/route.ts`
- `src/app/api/teams/logo-upload`, `src/app/api/teams/[id]/trim-logo`
- `src/app/lib/image-config.ts`, `lib/OptimizedImage.tsx`, `lib/utils/images.ts`

Focus: SSRF guard on proxy, path traversal in `[...path]` and delete-object, upload size/type
validation, who can sign/delete what, consolidate duplicate sign routes, hardcoded bucket
name (~10 files) → single config.

## Session 6 — Player stats pipeline
- `src/app/lib/refreshPlayerStats.ts` (aggregation correctness this time, not cascade)
- `src/app/dashboard/fix-stats/*`, `src/app/dashboard/refresh-stats/*`
- Readers: `src/app/paiktes/page.tsx` (filter/sort/pagination), `paiktes/types.ts` (resolveStat)

Focus: dual-write to legacy `player_statistics` — decide canonical and plan removal;
win attribution via `matches.winner_team_id` (two-legged ties?); incremental vs full
rebuild drift; own-goal handling.

## Session 7 — Public read surfaces (perf & correctness)
- `src/app/tournaments/loadTournamentIntoStore.tsx` + `[id]/v2-dark/*` + `stages/*`
- `src/app/matches/{page,MatchesExplorer*}.tsx`, `matches/[id]/{page,queries}.ts(x)`
- `src/app/OMADA/[id]/page.tsx` (live JS aggregation from match_player_stats)
- `src/app/standings/page.tsx`, `src/app/page.tsx` + `home/data.ts`

Focus: N+1 / over-fetching, ISR windows vs data freshness, browser-side direct Supabase
queries in the explorers (RLS exposure), two-standings-systems confusion (stage_standings
vs teams.season_score), duplicated home fetch logic.

## Session 8 — Dashboard CRUD (teams / players / matches / users)
- `src/app/dashboard/teams/*`, `dashboard/players/*`, `dashboard/matches/*`, `dashboard/users/*`
- Their API routes under `src/app/api/{teams,players,matches,admin}`

Focus: validation on create/edit, archive/soft-delete consistency, two-legged-aware winner
logic in RowEditor, role checks on every mutation route.

## Session 9 — Content & CMS  [XSS SURFACE]
- `src/app/api/{articles,articles-public,announcements}*/route.ts`
- `src/app/article/[slug]/page.tsx` (TipTap JSON → HTML server-side)
- `src/components/{AnnouncementContent,RichTextEditor}.tsx` (md/html/plain body rendering)
- `src/app/dashboard/{articles,announcements}/*`

Focus: sanitization of TipTap→HTML and raw-html announcement bodies, draft gating,
editor-role scoping, view-count RPC apparently unwired.

## Session 10 — Dead code & cleanup  [LOW RISK, MECHANICAL]
- Classic home component set (only used by `/preview/home-c`, `/hometest`)
- `/waves`, `/dotgrid`, `* copy.tsx`, `ModernKnockoutViewesr.tsx`, `LeaugeStage.tsx`,
  `newEventPilll.tsx`, legacy `AdminTeamsCRUD.tsx`, duplicate Supabase clients (`Server.ts`)
- Root-level debug scripts (`scripts/*.mjs`) — move or delete; stray `doc.html`, `home-top.png`

Focus: verify zero imports before deleting (grep each). Also: export a `0000-baseline.sql`
schema (tracked as a known gap).

---

Cross-session rules
- Branch per session from `main`; don't stack sessions on each other.
- Report findings before fixing; fix only confirmed bugs — cleanups go in separate commits.
- After fixes: `/code-review` on the diff; `/security-review` additionally for sessions 4, 5, 9.
- If a finding belongs to another session's scope, note it here under that session instead
  of fixing it out of scope.
