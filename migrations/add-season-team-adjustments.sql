-- Season-level manual point adjustments for the Γενική Κατάταξη (/geniki-katataxi).
-- Admins grant these from /dashboard/geniki-katataxi. Kinds cover every rule of the
-- points system so anything can be awarded by hand; the usual manual ones are:
--   διεθνής διάκριση            +1000
--   διεθνής συμμετοχή           +300
--   αποχώρηση από τουρνουά      -100
--   διακοπή αγώνα (υπαίτιος)    -30
--   other (ελεύθερο ποσό)
--
-- The public page works without this table (it simply shows no manual adjustments),
-- so this migration can be applied whenever convenient.

create table if not exists public.season_team_adjustments (
  id bigint generated always as identity primary key,
  season text not null,                -- matches tournaments.season, e.g. '2024/25'
  team_id bigint not null references public.teams (id) on delete cascade,
  kind text not null check (kind in (
    'international',                -- διεθνής διάκριση
    'international_participation', -- διεθνής συμμετοχή
    'withdrawal',                   -- αποχώρηση από τουρνουά
    'abandonment',                  -- διακοπή αγώνα (υπαίτιος)
    'participation',                -- συμμετοχή σε τουρνουά
    'qualification',                -- πρόκριση σε επόμενη φάση
    'tournament_winner',            -- νικητής τουρνουά
    'runner_up',                    -- διεκδικητής (φιναλίστ)
    'win', 'draw', 'loss',          -- νίκη / ισοπαλία / ήττα
    'other'
  )),
  points integer not null,             -- signed: +1000, +300, -100, -30, ...
  reason text,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

create index if not exists idx_season_team_adjustments_season
  on public.season_team_adjustments (season);
create index if not exists idx_season_team_adjustments_team
  on public.season_team_adjustments (team_id);

alter table public.season_team_adjustments enable row level security;

-- Public read (the standings page is public); writes only via service role / dashboard.
drop policy if exists "season_team_adjustments_public_read" on public.season_team_adjustments;
create policy "season_team_adjustments_public_read"
  on public.season_team_adjustments for select
  using (true);
