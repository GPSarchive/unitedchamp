// src/app/dashboard/matches/page.tsx
import MatchesDashboard from "./MatchesDashboard";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";

type SP = { tid?: string };

export default async function MatchesPage({
  searchParams,
}: {
  searchParams?: Promise<SP>;
}) {
  const sp = (await searchParams) ?? {};
  const tidParam = sp.tid ?? "";
  const selectedTid = tidParam ? Number(tidParam) : null;

  // --- Ομάδες (για dropdowns/labels) ---
  const { data: teams, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .order("name", { ascending: true });

  if (teamErr) {
    console.error("[matches/page] teams error", teamErr);
  }

  // --- Αγώνες με joins (όπως στο αρχικό dashboard) ---
  const { data: matchesWithJoins, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
      tournament_id, stage_id, group_id, matchday, round, bracket_pos, updated_at,
      team_a:team_a_id (id, name, logo),
      team_b:team_b_id (id, name, logo),
      tournament:tournament_id (id, name),
      stage:stage_id (id, name, kind),
      grp:group_id (id, name)
    `
    )
    .order("match_date", { ascending: true });

  if (matchErr) {
    console.error("[matches/page] matches error", matchErr);
  }

  // Map snake-joined keys → camel που περιμένει το UI
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
        />
      </div>

      <p className="text-xs text-white/50">
        Συμβουλή: Για ισοπαλίες σε στάδια που επιτρέπονται, άφησε το «Νικητής» κενό όταν η
        κατάσταση είναι «finished» και τα σκορ είναι ίσα.
      </p>
    </div>
  );
}
