// src/app/dashboard/matches/page.tsx
import MatchesDashboard from "./MatchesDashboard";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

type SP = { tid?: string };

export type MatchStatSummary = {
  match_id: number;
  scorers: Array<{
    player_id: number;
    team_id: number;
    first_name: string | null;
    last_name: string | null;
    goals: number;
    own_goals: number;
  }>;
  cards: Array<{
    player_id: number;
    team_id: number;
    yellow_cards: number;
    red_cards: number;
    blue_cards: number;
  }>;
};

export default async function MatchesPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const tidParam = sp.tid ?? "";
  const selectedTid = tidParam ? Number(tidParam) : null;

  // Fetch teams
  const { data: teams, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .order("name", { ascending: true });

  if (teamErr) {
    console.error("[matches/page] teams error", teamErr);
  }

  // Fetch matches with joins
  const { data: matchesWithJoins, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
      tournament_id, stage_id, group_id, matchday, round, bracket_pos, updated_at,
      postponement_reason, original_match_date, postponed_at,
      field,
      team_a:team_a_id (id, name, logo),
      team_b:team_b_id (id, name, logo),
      tournament:tournament_id (id, name),
      stage:stage_id (id, name, kind),
      grp:group_id (id, name)
    `
    )
    .order("match_date", { ascending: false });

  if (matchErr) {
    console.error("[matches/page] matches error", matchErr);
  }

  // Fetch stats summaries for all matches that have stats
  const { data: rawStats } = await supabaseAdmin
    .from("match_player_stats")
    .select(
      `
      match_id,
      player_id,
      team_id,
      goals,
      own_goals,
      assists,
      yellow_cards,
      red_cards,
      blue_cards,
      player:player_id(first_name, last_name)
    `
    )
    .or("goals.gt.0,own_goals.gt.0,yellow_cards.gt.0,red_cards.gt.0,blue_cards.gt.0");

  // Group stats by match_id
  const statsByMatch = new Map<number, MatchStatSummary>();

  for (const row of rawStats ?? []) {
    const r = row as any;
    const matchId: number = r.match_id;

    if (!statsByMatch.has(matchId)) {
      statsByMatch.set(matchId, { match_id: matchId, scorers: [], cards: [] });
    }

    const summary = statsByMatch.get(matchId)!;

    if ((r.goals ?? 0) > 0 || (r.own_goals ?? 0) > 0) {
      summary.scorers.push({
        player_id: r.player_id,
        team_id: r.team_id,
        first_name: r.player?.first_name ?? null,
        last_name: r.player?.last_name ?? null,
        goals: r.goals ?? 0,
        own_goals: r.own_goals ?? 0,
      });
    }

    if (
      (r.yellow_cards ?? 0) > 0 ||
      (r.red_cards ?? 0) > 0 ||
      (r.blue_cards ?? 0) > 0
    ) {
      summary.cards.push({
        player_id: r.player_id,
        team_id: r.team_id,
        yellow_cards: r.yellow_cards ?? 0,
        red_cards: r.red_cards ?? 0,
        blue_cards: r.blue_cards ?? 0,
      });
    }
  }

  const initialMatches = (matchesWithJoins ?? []).map(
    ({ team_a, team_b, ...rest }: any) => ({
      ...rest,
      teamA: team_a ?? null,
      teamB: team_b ?? null,
    })
  );

  const initialTeams = teams ?? [];

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Αγώνες</h2>
      </header>

      <p className="text-white/70">
        Διαχείριση προγράμματος, σκορ και κατάστασης. Μπορείς να φιλτράρεις ανά διοργάνωση,
        να αναζητήσεις με βάση το όνομα ομάδας και να ταξινομήσεις.
      </p>

      <div className="rounded-2xl border border-white/10 bg-black/40 p-3">
        <MatchesDashboard
          initialTeams={initialTeams}
          initialMatches={initialMatches}
          defaultTournamentId={selectedTid}
          statsByMatch={Object.fromEntries(statsByMatch)}
        />
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Για ισοπαλίες σε στάδια που επιτρέπονται, άφησε το «Νικητής» κενό όταν η
        κατάσταση είναι «finished» και τα σκορ είναι ίσα.
      </p>
    </div>
  );
}
