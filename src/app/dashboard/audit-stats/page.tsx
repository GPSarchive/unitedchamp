import { auditPlayerStats, type Cause, type DriftRow } from "@/app/lib/auditPlayerStats";

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

const CAUSE_INFO: Record<Cause, { title: string; explain: string; cls: string }> = {
  missed_refresh: {
    title: "Save not propagated",
    explain:
      "The match stats were saved, but the after-save refresh of this aggregate never ran (the code fires it without waiting and the request ends first). The listed matches are missing from the totals — their stats add up exactly to the difference.",
    cls: "bg-amber-900/50 text-amber-300 border-amber-700",
  },
  truncation: {
    title: "Undercounted (truncated read)",
    explain:
      "The stored value is too low, but no specific match explains the gap. This matches the known bug where the sync reads match stats without pagination and Supabase silently cuts the response at ~1000 rows, so totals are computed from incomplete data.",
    cls: "bg-orange-900/50 text-orange-300 border-orange-700",
  },
  stale_data: {
    title: "Leftover from deleted/edited stats",
    explain:
      "The stored value is HIGHER than the match stats support. Stats were deleted or reduced in a match, but this aggregate was never refreshed (the refresh only covers players still present in the match).",
    cls: "bg-purple-900/50 text-purple-300 border-purple-700",
  },
  never_written: {
    title: "Row never written",
    explain:
      "This player has match stats but no aggregate row at all — the refresh never ran for them, or their data predates the cache backfill.",
    cls: "bg-red-900/50 text-red-300 border-red-700",
  },
  stale_row: {
    title: "Orphan row",
    explain:
      "An aggregate row exists but the player has no match stats left to support it — the source rows were deleted and the aggregate was never cleaned up.",
    cls: "bg-purple-900/50 text-purple-300 border-purple-700",
  },
  unexplained: {
    title: "Mixed — needs manual look",
    explain:
      "Some values are too high and others too low, so no single cause fits. Likely a combination (e.g. an edit that was partially propagated).",
    cls: "bg-gray-800 text-gray-300 border-gray-600",
  },
};

function fmtDate(d: string | null): string {
  if (!d) return "no date";
  return new Date(d).toLocaleDateString("el-GR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function DriftItem({ row }: { row: DriftRow }) {
  const cause = CAUSE_INFO[row.diagnosis.cause];
  const showMatches = row.diagnosis.matches.length > 0 && row.diagnosis.cause !== "never_written";
  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{row.playerName}</span>
        {row.tournamentId != null && (
          <span className="text-xs text-gray-500">tournament #{row.tournamentId}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full border ${cause.cls}`}>{cause.title}</span>
        {row.diagnosis.cause === "missed_refresh" && row.diagnosis.exact && (
          <span className="text-xs text-green-500">cause confirmed — amounts match exactly</span>
        )}
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

      {showMatches && (
        <div className="mt-1.5 text-sm text-gray-400">
          <span className="text-gray-500">
            {row.diagnosis.cause === "missed_refresh"
              ? "Missing from totals:"
              : "Saved after the last refresh (leads):"}
          </span>
          <ul className="mt-0.5 space-y-0.5">
            {row.diagnosis.matches.slice(0, 8).map((m) => (
              <li key={m.matchId}>
                <span className="text-gray-500">{fmtDate(m.date)}</span> {m.label}{" "}
                <span className="text-amber-400">({m.contribution})</span>{" "}
                <span className="text-gray-600">#{m.matchId}</span>
              </li>
            ))}
            {row.diagnosis.matches.length > 8 && (
              <li className="text-gray-600">… and {row.diagnosis.matches.length - 8} more matches</li>
            )}
          </ul>
        </div>
      )}
    </li>
  );
}

export default async function AuditStatsPage() {
  const started = Date.now();
  const result = await auditPlayerStats();
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  const clean = result.totalDrifted === 0;

  const activeCauses = (Object.entries(result.causeCounts) as [Cause, number][])
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-white">
      <h1 className="text-2xl font-bold">Player Stats Drift Audit</h1>
      <p className="text-gray-400 text-sm">
        Every visit recomputes all aggregates fresh from <code>match_player_stats</code> (
        {result.mpsRowCount} rows, {result.matchCount} matches) and compares them with the stored
        values, then works out which bug caused each difference. Red = what the database has now,
        green = what it should be. Read-only — nothing is changed. Ran in {elapsed}s.
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
          : `✗ Drift found: ${result.totalDrifted} row${result.totalDrifted === 1 ? "" : "s"} out of sync across the three aggregate tables.`}
      </div>

      {!clean && (
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-3">
          <h2 className="text-lg font-semibold">What went wrong</h2>
          {activeCauses.map(([cause, count]) => {
            const info = CAUSE_INFO[cause];
            return (
              <div key={cause} className="text-sm">
                <span className={`text-xs px-2 py-0.5 rounded-full border mr-2 ${info.cls}`}>
                  {info.title}
                </span>
                <span className="font-semibold">{count} row{count === 1 ? "" : "s"}</span>
                <p className="text-gray-400 mt-1">{info.explain}</p>
              </div>
            );
          })}
        </section>
      )}

      {result.hotMatches.length > 0 && (
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
          <h2 className="text-lg font-semibold">Matches whose save never propagated</h2>
          <p className="text-xs text-gray-500 mt-0.5 mb-2">
            These matches are absent from players&apos; totals — the refresh after saving them
            never completed. Re-saving the match (or running /dashboard/refresh-stats) heals them.
          </p>
          <ul className="space-y-1 text-sm">
            {result.hotMatches.map((m) => (
              <li key={m.matchId}>
                <span className="text-gray-500">{fmtDate(m.date)}</span> {m.label}{" "}
                <span className="text-red-400 font-semibold">
                  {m.playersAffected} player{m.playersAffected === 1 ? "" : "s"} affected
                </span>{" "}
                <span className="text-gray-600">#{m.matchId}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          {t.drifted.length > 0 && (
            <ul className="divide-y divide-gray-800">
              {t.drifted.map((row) => (
                <DriftItem key={`${row.playerId}:${row.tournamentId ?? ""}`} row={row} />
              ))}
            </ul>
          )}
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
