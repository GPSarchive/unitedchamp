import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import RefreshButton from "./RefreshButton";

export const dynamic = "force-dynamic";

export default async function RefreshStatsPage() {
  // Show current counts so you can verify the backfill worked
  const { count: careerCount } = await supabaseAdmin
    .from("player_career_stats")
    .select("*", { count: "exact", head: true });

  const { count: tournamentCount } = await supabaseAdmin
    .from("player_tournament_stats")
    .select("*", { count: "exact", head: true });

  // Sample of top 10 career stats by goals
  const { data: topGoals } = await supabaseAdmin
    .from("player_career_stats")
    .select(
      "player_id, total_matches, total_goals, total_assists, total_wins, total_mvp, total_best_gk, primary_team_id"
    )
    .order("total_goals", { ascending: false })
    .limit(10);

  // Get player names for the sample
  const playerIds = (topGoals ?? []).map((r) => r.player_id);
  const { data: playerNames } = playerIds.length
    ? await supabaseAdmin
        .from("player")
        .select("id, first_name, last_name")
        .in("id", playerIds)
    : { data: [] };

  const nameMap = new Map(
    (playerNames ?? []).map((p) => [
      p.id,
      `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `#${p.id}`,
    ])
  );

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8 text-white">
      <h1 className="text-2xl font-bold">Refresh Player Stats Cache</h1>

      <p className="text-gray-400">
        This page lets you run a full backfill of the <code>player_career_stats</code> and{" "}
        <code>player_tournament_stats</code> tables. These tables are normally updated
        automatically when matches finish, but you can run this to populate them for the
        first time or to fix any drift.
      </p>

      <div className="flex gap-8 text-sm">
        <div className="p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-400">Career stats rows:</span>{" "}
          <span className="font-mono font-bold">{careerCount ?? 0}</span>
        </div>
        <div className="p-3 bg-gray-800 rounded-lg">
          <span className="text-gray-400">Tournament stats rows:</span>{" "}
          <span className="font-mono font-bold">{tournamentCount ?? 0}</span>
        </div>
      </div>

      <RefreshButton />

      {(topGoals ?? []).length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Top 10 by Goals (preview)</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-left">
                <th className="py-2 pr-3">Player</th>
                <th className="py-2 px-2">Matches</th>
                <th className="py-2 px-2">Goals</th>
                <th className="py-2 px-2">Assists</th>
                <th className="py-2 px-2">Wins</th>
                <th className="py-2 px-2">MVP</th>
                <th className="py-2 px-2">Best GK</th>
              </tr>
            </thead>
            <tbody>
              {(topGoals ?? []).map((r) => (
                <tr key={r.player_id} className="border-b border-gray-800">
                  <td className="py-2 pr-3">{nameMap.get(r.player_id) ?? `#${r.player_id}`}</td>
                  <td className="py-2 px-2 font-mono">{r.total_matches}</td>
                  <td className="py-2 px-2 font-mono font-bold">{r.total_goals}</td>
                  <td className="py-2 px-2 font-mono">{r.total_assists}</td>
                  <td className="py-2 px-2 font-mono">{r.total_wins}</td>
                  <td className="py-2 px-2 font-mono">{r.total_mvp}</td>
                  <td className="py-2 px-2 font-mono">{r.total_best_gk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
