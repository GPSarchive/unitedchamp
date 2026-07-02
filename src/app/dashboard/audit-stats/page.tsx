import { auditPlayerStats, type DriftRow } from "@/app/lib/auditPlayerStats";

export const dynamic = "force-dynamic";

const FIELD_LABELS: Record<string, string> = {
  total_goals: "Goals",
  total_assists: "Assists",
  total_yellow_cards: "Yellow",
  total_red_cards: "Red",
  total_blue_cards: "Blue",
  total_matches: "Matches",
  total_mvp: "MVP",
  total_best_gk: "Best GK",
  total_wins: "Wins",
  goals: "Goals",
  assists: "Assists",
  yellow_cards: "Yellow",
  red_cards: "Red",
  blue_cards: "Blue",
  matches: "Matches",
  mvp_count: "MVP",
  best_gk_count: "Best GK",
  wins: "Wins",
};

const KIND_LABELS: Record<DriftRow["kind"], { text: string; cls: string }> = {
  mismatch: { text: "wrong values", cls: "bg-amber-900/50 text-amber-300 border-amber-700" },
  missing: { text: "never written", cls: "bg-red-900/50 text-red-300 border-red-700" },
  stale: { text: "stale leftover", cls: "bg-purple-900/50 text-purple-300 border-purple-700" },
};

function DriftList({ rows }: { rows: DriftRow[] }) {
  return (
    <ul className="divide-y divide-gray-800">
      {rows.map((row) => {
        const kind = KIND_LABELS[row.kind];
        return (
          <li key={`${row.playerId}:${row.tournamentId ?? ""}`} className="py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{row.playerName}</span>
              {row.tournamentId != null && (
                <span className="text-xs text-gray-500">tournament #{row.tournamentId}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full border ${kind.cls}`}>
                {kind.text}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm font-mono">
              {row.diffs.map((d) => (
                <span key={d.field}>
                  <span className="text-gray-400">{FIELD_LABELS[d.field] ?? d.field}:</span>{" "}
                  <span className="text-red-400 line-through">{d.stored}</span>{" "}
                  <span className="text-green-400">→ {d.recomputed}</span>
                </span>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export default async function AuditStatsPage() {
  const started = Date.now();
  const result = await auditPlayerStats();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const clean = result.totalDrifted === 0;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-white">
      <h1 className="text-2xl font-bold">Player Stats Drift Audit</h1>
      <p className="text-gray-400 text-sm">
        Every visit recomputes all aggregates fresh from <code>match_player_stats</code> (
        {result.mpsRowCount} rows, {result.matchCount} matches) and compares them with the stored
        values. Red = what the database has now, green = what it should be. Read-only — nothing is
        changed. Ran in {elapsed}s.
      </p>

      <div
        className={`p-4 rounded-lg border text-lg font-semibold ${
          clean
            ? "bg-green-900/40 border-green-700 text-green-300"
            : "bg-red-900/40 border-red-700 text-red-300"
        }`}
      >
        {clean
          ? "✓ No drift — all player statistics match the match stats."
          : `✗ Drift found: ${result.totalDrifted} player row${result.totalDrifted === 1 ? "" : "s"} out of sync. The save flow wrote match stats without the aggregates following.`}
      </div>

      {result.tables.map((t) => (
        <section key={t.table} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold font-mono">{t.table}</h2>
            <span
              className={`text-sm font-semibold ${
                t.drifted.length === 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {t.drifted.length === 0
                ? `✓ ${t.rowsChecked} players OK`
                : `✗ ${t.drifted.length} of ${t.rowsChecked} drifted`}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{t.description}</p>
          {t.drifted.length > 0 && <DriftList rows={t.drifted} />}
        </section>
      ))}

      {!clean && (
        <p className="text-sm text-gray-400">
          Recovery: <code>/dashboard/refresh-stats</code> rebuilds the two cache tables correctly.
          Avoid <code>/dashboard/fix-stats</code> while there are more than 1000 stat rows — its
          unpaginated read writes truncated totals.
        </p>
      )}
    </div>
  );
}
