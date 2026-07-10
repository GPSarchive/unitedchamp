-- ============================================================================
-- enable-public-read-rls.sql  (Session 4 closure — run once in Supabase SQL
-- editor; idempotent, safe to re-run)
--
-- Locks the anon key down to exactly the data plane the app's anon-key paths
-- use, and closes three WRITE gaps found by scripts/audit-rls.mjs (2026-07-10):
-- match_player_stats, match_participants and disciplinary_actions accepted
-- anonymous INSERTs (they only failed on FK/trigger checks).
--
-- Consumer map this is derived from (verified in code, sessions 4+7):
--   Browser (anon key): matches + embedded teams/tournaments only
--     (MatchesExplorer, RecentMatchesTabs, hometest, dashboard RowEditor).
--   RLS-bound server routes (anon role for visitors):
--     /api/stages/[id]/standings -> stage_standings, teams,
--        tournament_groups, tournament_stages
--     /api/articles, /article/[slug]      -> articles   (published only)
--     /api/announcements, /announcement/[id] -> announcements (published only)
--   Everything else on public pages reads via the service role (bypasses RLS)
--   and is unaffected.  Dashboard flows using the cookie-bound authenticated
--   client (stats editor etc.) are covered by can_edit_content() policies
--   (function deployed by add-editor-role-rls.sql — run that first if
--   can_edit_content() is missing).
--
-- Verify before/after with:  node scripts/audit-rls.mjs
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0) Make sure RLS is enabled everywhere we set policy (idempotent).
--    The service role bypasses RLS, so server-rendered pages are unaffected.
-- ---------------------------------------------------------------------------
ALTER TABLE public.matches                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_stages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_teams        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_awards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_standings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stage_slots             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.intake_mappings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_player_stats      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_statistics       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_career_stats     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_tournament_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.disciplinary_actions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.season_team_adjustments ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 1) Drop every existing SELECT policy on the tables we manage, so the read
--    posture below is canonical regardless of what the dashboard UI created
--    over time.  Write (INSERT/UPDATE/DELETE) policies are left untouched
--    except for the three gap tables handled in section 3.
-- ---------------------------------------------------------------------------
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd = 'SELECT'
      AND tablename IN (
        'matches','teams','tournaments','tournament_stages','tournament_groups',
        'tournament_teams','tournament_awards','stage_standings','stage_slots',
        'intake_mappings','match_player_stats','match_participants','player',
        'player_teams','player_statistics','player_career_stats',
        'player_tournament_stats','articles','announcements',
        'disciplinary_actions','season_team_adjustments'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) Read policies
-- ---------------------------------------------------------------------------

-- 2a) PUBLIC-READ — the anon data plane the UI actually uses. Full-row reads
--     for everyone (anon + authenticated). These tables contain nothing that
--     is not already rendered on public pages.
CREATE POLICY public_read ON public.matches            FOR SELECT USING (true);
CREATE POLICY public_read ON public.teams              FOR SELECT USING (true);
CREATE POLICY public_read ON public.tournaments        FOR SELECT USING (true);
CREATE POLICY public_read ON public.tournament_stages  FOR SELECT USING (true);
CREATE POLICY public_read ON public.tournament_groups  FOR SELECT USING (true);
CREATE POLICY public_read ON public.tournament_teams   FOR SELECT USING (true);
CREATE POLICY public_read ON public.tournament_awards  FOR SELECT USING (true);
CREATE POLICY public_read ON public.stage_standings    FOR SELECT USING (true);

-- 2b) PUBLISHED-ONLY — visitors see published content; staff see everything
--     (drafts in the dashboard editor go through the cookie-bound client).
CREATE POLICY public_read_published ON public.articles
  FOR SELECT USING (status = 'published' OR public.can_edit_content());
CREATE POLICY public_read_published ON public.announcements
  FOR SELECT USING (status = 'published' OR public.can_edit_content());

-- 2c) STAFF-ONLY — no anon-key code path reads these; public pages get them
--     via the service role. Locks up player PII (birth_date), disciplinary
--     reasons, per-match stat rows, engine wiring and stat caches.
CREATE POLICY staff_read ON public.player                  FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.player_teams            FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.player_statistics       FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.player_career_stats     FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.player_tournament_stats FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.match_player_stats      FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.match_participants      FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.disciplinary_actions    FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.season_team_adjustments FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.stage_slots             FOR SELECT USING (public.can_edit_content());
CREATE POLICY staff_read ON public.intake_mappings         FOR SELECT USING (public.can_edit_content());

-- ---------------------------------------------------------------------------
-- 3) Close the WRITE gaps. audit-rls.mjs proved anon INSERTs pass RLS on
--    these three tables today. Replace ALL their write policies with the
--    canonical staff-only set (same pattern as add-editor-role-rls.sql).
-- ---------------------------------------------------------------------------
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND cmd IN ('INSERT','UPDATE','DELETE','ALL')
      AND tablename IN ('match_player_stats','match_participants','disciplinary_actions')
  LOOP
    EXECUTE format('DROP POLICY %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

CREATE POLICY staff_insert ON public.match_player_stats   FOR INSERT WITH CHECK (public.can_edit_content());
CREATE POLICY staff_update ON public.match_player_stats   FOR UPDATE USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY staff_delete ON public.match_player_stats   FOR DELETE USING (public.can_edit_content());

CREATE POLICY staff_insert ON public.match_participants   FOR INSERT WITH CHECK (public.can_edit_content());
CREATE POLICY staff_update ON public.match_participants   FOR UPDATE USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY staff_delete ON public.match_participants   FOR DELETE USING (public.can_edit_content());

CREATE POLICY staff_insert ON public.disciplinary_actions FOR INSERT WITH CHECK (public.can_edit_content());
CREATE POLICY staff_update ON public.disciplinary_actions FOR UPDATE USING (public.can_edit_content()) WITH CHECK (public.can_edit_content());
CREATE POLICY staff_delete ON public.disciplinary_actions FOR DELETE USING (public.can_edit_content());

COMMIT;

-- ============================================================================
-- After running: node scripts/audit-rls.mjs should show
--   - SELECT ALLOWED only on: matches, teams, tournaments, tournament_stages,
--     tournament_groups, tournament_teams, tournament_awards, stage_standings,
--     articles, announcements (published rows only)
--   - every table: anon INSERT -> "RLS-BLOCKED (good)"
-- Then click through /, /matches (browse + filters), /tournaments/[id],
-- /OMADA/[id], /articles, an article page, and the dashboard stats editor
-- (save a match) to confirm nothing regressed.
-- ============================================================================
