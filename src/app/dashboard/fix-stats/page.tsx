import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import ApplyFixButton from "./ApplyFixButton";

export const dynamic = "force-dynamic";

type CurrentStats = {
  player_id: number;
  total_goals: number;
  total_assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
};

type PlayerName = {
  id: number;
  first_name: string | null;
  last_name: string | null;
};

export default async function FixStatsPage() {
  // 1. Current player_statistics
  const { data: currentRows } = await supabaseAdmin
    .from("player_statistics")
    .select("player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards");

  const current = new Map<number, CurrentStats>();
  for (const r of (currentRows ?? []) as CurrentStats[]) {
    current.set(r.player_id, r);
  }

  // 2. Recalculated from match_player_stats
  const { data: mpsRows } = await supabaseAdmin
    .from("match_player_stats")
    .select("player_id, goals, assists, yellow_cards, red_cards, blue_cards");

  const recalc = new Map<number, CurrentStats>();
  for (const r of (mpsRows ?? []) as {
    player_id: number;
    goals: number | null;
    assists: number | null;
    yellow_cards: number | null;
    red_cards: number | null;
    blue_cards: number | null;
  }[]) {
    if (!recalc.has(r.player_id)) {
      recalc.set(r.player_id, {
        player_id: r.player_id,
        total_goals: 0,
        total_assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
      });
    }
    const t = recalc.get(r.player_id)!;
    t.total_goals += Number(r.goals) || 0;
    t.total_assists += Number(r.assists) || 0;
    t.yellow_cards += Number(r.yellow_cards) || 0;
    t.red_cards += Number(r.red_cards) || 0;
    t.blue_cards += Number(r.blue_cards) || 0;
  }

  // 3. Fetch player names
  const allPlayerIds = Array.from(
    new Set([...current.keys(), ...recalc.keys()])
  );

  const { data: playerRows } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name")
    .in("id", allPlayerIds.length > 0 ? allPlayerIds : [-1]);

  const names = new Map<number, string>();
  for (const p of (playerRows ?? []) as PlayerName[]) {
    names.set(p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Player #${p.id}`);
  }

  // 4. Build comparison rows (only show players with differences)
  const ZERO: CurrentStats = {
    player_id: 0,
    total_goals: 0,
    total_assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    blue_cards: 0,
  };

  type CompRow = {
    player_id: number;
    name: string;
    cur: CurrentStats;
    next: CurrentStats;
    hasDiff: boolean;
  };

  const rows: CompRow[] = allPlayerIds
    .map((pid) => {
      const cur = current.get(pid) ?? { ...ZERO, player_id: pid };
      const next = recalc.get(pid) ?? { ...ZERO, player_id: pid };
      const hasDiff =
        cur.total_goals !== next.total_goals ||
        cur.total_assists !== next.total_assists ||
        cur.yellow_cards !== next.yellow_cards ||
        cur.red_cards !== next.red_cards ||
        cur.blue_cards !== next.blue_cards;
      return {
        player_id: pid,
        name: names.get(pid) ?? `Player #${pid}`,
        cur,
        next,
        hasDiff,
      };
    })
    .sort((a, b) => {
      // Diffs first, then by name
      if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  const diffCount = rows.filter((r) => r.hasDiff).length;
  const STAT_KEYS = [
    { key: "total_goals" as const, label: "Goals" },
    { key: "total_assists" as const, label: "Assists" },
    { key: "yellow_cards" as const, label: "Yellow" },
    { key: "red_cards" as const, label: "Red" },
    { key: "blue_cards" as const, label: "Blue" },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Player Statistics Sync Preview
          </h1>
          <p className="text-sm text-white/60 mt-1">
            Compares current <code className="bg-white/10 px-1 rounded">player_statistics</code> with
            values recalculated from <code className="bg-white/10 px-1 rounded">match_player_stats</code>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-white/50">
            {diffCount} player{diffCount !== 1 ? "s" : ""} with mismatched data
          </span>
          {diffCount > 0 && <ApplyFixButton />}
        </div>
      </div>

      {diffCount === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-8 text-center">
          <span className="text-emerald-400 text-lg font-semibold">
            All player statistics are in sync!
          </span>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-white/60 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3">Player</th>
                {STAT_KEYS.map((s) => (
                  <th key={s.key} className="px-3 py-3 text-center" colSpan={2}>
                    {s.label}
                  </th>
                ))}
              </tr>
              <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest">
                <th />
                {STAT_KEYS.map((s) => (
                  <Fragment key={s.key}>
                    <th className="px-3 py-1 text-center">Now</th>
                    <th className="px-3 py-1 text-center">Fixed</th>
                  </Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .filter((r) => r.hasDiff)
                .map((r) => (
                  <tr
                    key={r.player_id}
                    className="border-b border-white/5 hover:bg-white/5"
                  >
                    <td className="px-4 py-2.5 text-white font-medium whitespace-nowrap">
                      {r.name}
                      <span className="ml-2 text-white/30 text-xs">#{r.player_id}</span>
                    </td>
                    {STAT_KEYS.map((s) => {
                      const curVal = r.cur[s.key];
                      const nextVal = r.next[s.key];
                      const changed = curVal !== nextVal;
                      return (
                        <Fragment key={s.key}>
                          <td
                            className={`px-3 py-2.5 text-center font-mono ${
                              changed ? "text-red-400 line-through opacity-70" : "text-white/50"
                            }`}
                          >
                            {curVal}
                          </td>
                          <td
                            className={`px-3 py-2.5 text-center font-mono ${
                              changed ? "text-emerald-400 font-semibold" : "text-white/50"
                            }`}
                          >
                            {nextVal}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Show all players (including matching) in a collapsed section */}
      {rows.length > diffCount && (
        <details className="rounded-xl border border-white/10 bg-white/5">
          <summary className="px-4 py-3 text-sm text-white/50 cursor-pointer hover:text-white/70">
            Show all {rows.length} players (including {rows.length - diffCount} already in sync)
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-white/60 text-xs uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Player</th>
                  {STAT_KEYS.map((s) => (
                    <th key={s.key} className="px-3 py-3 text-center" colSpan={2}>
                      {s.label}
                    </th>
                  ))}
                </tr>
                <tr className="border-b border-white/10 text-white/40 text-[10px] uppercase tracking-widest">
                  <th />
                  {STAT_KEYS.map((s) => (
                    <Fragment key={s.key}>
                      <th className="px-3 py-1 text-center">Now</th>
                      <th className="px-3 py-1 text-center">Fixed</th>
                    </Fragment>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.player_id}
                    className={`border-b border-white/5 ${r.hasDiff ? "bg-amber-500/5" : ""}`}
                  >
                    <td className="px-4 py-2 text-white font-medium whitespace-nowrap">
                      {r.name}
                      <span className="ml-2 text-white/30 text-xs">#{r.player_id}</span>
                    </td>
                    {STAT_KEYS.map((s) => {
                      const curVal = r.cur[s.key];
                      const nextVal = r.next[s.key];
                      const changed = curVal !== nextVal;
                      return (
                        <Fragment key={s.key}>
                          <td
                            className={`px-3 py-2 text-center font-mono ${
                              changed ? "text-red-400 line-through opacity-70" : "text-white/40"
                            }`}
                          >
                            {curVal}
                          </td>
                          <td
                            className={`px-3 py-2 text-center font-mono ${
                              changed ? "text-emerald-400 font-semibold" : "text-white/40"
                            }`}
                          >
                            {nextVal}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}

// Need Fragment for JSX
import { Fragment } from "react";
