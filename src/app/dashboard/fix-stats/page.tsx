import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import StatsTable from "./StatsTable";

export const dynamic = "force-dynamic";

export type MatchDetail = {
  match_id: number;
  match_date: string | null;
  team_a_name: string;
  team_b_name: string;
  team_a_score: number;
  team_b_score: number;
  status: string;
  goals: number;
  assists: number;
  own_goals: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
};

export type CompRow = {
  player_id: number;
  name: string;
  cur: Stats;
  next: Stats;
  hasDiff: boolean;
  matches: MatchDetail[];
};

export type Stats = {
  total_goals: number;
  total_assists: number;
  yellow_cards: number;
  red_cards: number;
  blue_cards: number;
};

export default async function FixStatsPage() {
  // 1. Current player_statistics
  const { data: currentRows } = await supabaseAdmin
    .from("player_statistics")
    .select("player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards");

  const current = new Map<number, Stats & { player_id: number }>();
  for (const r of (currentRows ?? []) as (Stats & { player_id: number })[]) {
    current.set(r.player_id, r);
  }

  // 2. Match-level data with match info (joined)
  const { data: mpsRows } = await supabaseAdmin
    .from("match_player_stats")
    .select(`
      player_id,
      match_id,
      goals,
      assists,
      own_goals,
      yellow_cards,
      red_cards,
      blue_cards,
      matches!inner(
        id,
        match_date,
        status,
        team_a_score,
        team_b_score,
        team_a:teams!matches_team_a_id_fkey(name),
        team_b:teams!matches_team_b_id_fkey(name)
      )
    `);

  // 3. Aggregate + collect per-player match details
  const recalc = new Map<number, Stats>();
  const matchDetails = new Map<number, MatchDetail[]>();

  for (const r of (mpsRows ?? []) as any[]) {
    const pid: number = r.player_id;

    // Aggregate totals
    if (!recalc.has(pid)) {
      recalc.set(pid, {
        total_goals: 0,
        total_assists: 0,
        yellow_cards: 0,
        red_cards: 0,
        blue_cards: 0,
      });
    }
    const t = recalc.get(pid)!;
    t.total_goals += Number(r.goals) || 0;
    t.total_assists += Number(r.assists) || 0;
    t.yellow_cards += Number(r.yellow_cards) || 0;
    t.red_cards += Number(r.red_cards) || 0;
    t.blue_cards += Number(r.blue_cards) || 0;

    // Collect match detail
    if (!matchDetails.has(pid)) matchDetails.set(pid, []);
    const m = r.matches;
    matchDetails.get(pid)!.push({
      match_id: r.match_id,
      match_date: m?.match_date ?? null,
      team_a_name: m?.team_a?.name ?? "?",
      team_b_name: m?.team_b?.name ?? "?",
      team_a_score: m?.team_a_score ?? 0,
      team_b_score: m?.team_b_score ?? 0,
      status: m?.status ?? "?",
      goals: Number(r.goals) || 0,
      assists: Number(r.assists) || 0,
      own_goals: Number(r.own_goals) || 0,
      yellow_cards: Number(r.yellow_cards) || 0,
      red_cards: Number(r.red_cards) || 0,
      blue_cards: Number(r.blue_cards) || 0,
    });
  }

  // 4. Fetch player names
  const allPlayerIds = Array.from(
    new Set([...current.keys(), ...recalc.keys()])
  );

  const { data: playerRows } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name")
    .in("id", allPlayerIds.length > 0 ? allPlayerIds : [-1]);

  const names = new Map<number, string>();
  for (const p of (playerRows ?? []) as { id: number; first_name: string | null; last_name: string | null }[]) {
    names.set(p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `Player #${p.id}`);
  }

  // 5. Build comparison rows
  const ZERO: Stats = {
    total_goals: 0,
    total_assists: 0,
    yellow_cards: 0,
    red_cards: 0,
    blue_cards: 0,
  };

  const rows: CompRow[] = allPlayerIds
    .map((pid) => {
      const cur = current.get(pid) ?? { ...ZERO };
      const next = recalc.get(pid) ?? { ...ZERO };
      const hasDiff =
        cur.total_goals !== next.total_goals ||
        cur.total_assists !== next.total_assists ||
        cur.yellow_cards !== next.yellow_cards ||
        cur.red_cards !== next.red_cards ||
        cur.blue_cards !== next.blue_cards;

      const playerMatches = (matchDetails.get(pid) ?? []).sort((a, b) => {
        if (a.match_date && b.match_date) return b.match_date.localeCompare(a.match_date);
        if (a.match_date) return -1;
        return 1;
      });

      return {
        player_id: pid,
        name: names.get(pid) ?? `Player #${pid}`,
        cur: { total_goals: cur.total_goals, total_assists: cur.total_assists, yellow_cards: cur.yellow_cards, red_cards: cur.red_cards, blue_cards: cur.blue_cards },
        next: { total_goals: next.total_goals, total_assists: next.total_assists, yellow_cards: next.yellow_cards, red_cards: next.red_cards, blue_cards: next.blue_cards },
        hasDiff,
        matches: playerMatches,
      };
    })
    .sort((a, b) => {
      if (a.hasDiff !== b.hasDiff) return a.hasDiff ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

  return <StatsTable rows={rows} />;
}
