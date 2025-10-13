// src/app/paiktes/page.tsx
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import PlayersClient from "./PlayersClient"; // <-- same folder
import type { PlayerLite } from "./types";

export const revalidate = 60;

// --- storage signing config ---
const BUCKET = "GPSarchive's Project";
const SIGN_TTL_SECONDS = 60 * 5; // Keep > revalidate (60s) to avoid mid-page expiry

type PlayerRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  photo: string | null;
  position: string | null;
  height_cm: number | null;
  birth_date: string | null;
};

type PlayerTeamRow = {
  player_id: number;
  team_id: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type TeamRow = { id: number; name: string | null; logo: string | null };

type PlayerStatsRow = {
  player_id: number;
  total_goals: number | null;
  total_assists: number | null;
  yellow_cards: number | null;
  red_cards: number | null;
  blue_cards: number | null;
};

type MPSRow = {
  player_id: number;
  match_id: number;
  mvp: boolean | null;
  best_goalkeeper: boolean | null;
};

// Detect if a value is a storage object path (vs absolute URL, root path, or data URL)
function isStoragePathServer(v: string | null | undefined) {
  if (!v) return false;
  if (/^(https?:)?\/\//i.test(v)) return false; // absolute or protocol-relative
  if (v.startsWith("/")) return false;          // root-relative
  if (v.startsWith("data:")) return false;      // data URL
  return true;                                  // looks like "folder/object.png"
}

// Sign a storage path into an absolute, time-limited URL; otherwise return as-is
async function signIfStoragePath(v: string | null | undefined) {
  if (!v) return null;
  if (!isStoragePathServer(v)) return v;

  const { data, error } = await supabaseAdmin
    .storage
    .from(BUCKET)
    .createSignedUrl(v, SIGN_TTL_SECONDS);

  return error ? null : data?.signedUrl ?? null;
}

export default async function PaiktesPage() {
  // 1) Players
  const { data: players, error: pErr } = await supabaseAdmin
    .from("player")
    .select("id, first_name, last_name, photo, position, height_cm, birth_date")
    .order("last_name", { ascending: true })
    .order("first_name", { ascending: true });

  if (pErr) console.error("[paiktes] players query error:", pErr.message);
  const p = (players ?? []) as PlayerRow[];
  const playerIds = p.map((x) => x.id);

  // 2) Team memberships
  const { data: ptRows, error: ptErr } = await supabaseAdmin
    .from("player_teams")
    .select("player_id, team_id, created_at, updated_at")
    .order("player_id", { ascending: true })
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false });

  if (ptErr) console.error("[paiktes] player_teams query error:", ptErr.message);

  const currentTeamIdByPlayer = new Map<number, number>();
  for (const r of (ptRows ?? []) as PlayerTeamRow[]) {
    if (!currentTeamIdByPlayer.has(r.player_id) && r.team_id != null) {
      currentTeamIdByPlayer.set(r.player_id, r.team_id);
    }
  }

  // 3) Teams (fetch + pre-sign logos on the server)
  const teamIds = Array.from(new Set(Array.from(currentTeamIdByPlayer.values())));
  const { data: teams } = teamIds.length
    ? await supabaseAdmin.from("teams").select("id, name, logo").in("id", teamIds)
    : { data: [] as TeamRow[] };

  const teamEntries = await Promise.all(
    (teams ?? []).map(async (t) => {
      const signedLogo = await signIfStoragePath(t.logo ?? null);
      return [t.id, { name: t.name ?? "", logo: signedLogo }] as const;
    })
  );
  const teamMap: Record<number, { name: string; logo: string | null }> =
    Object.fromEntries(teamEntries);

  // 4) Career totals
  const { data: statsRows } = playerIds.length
    ? await supabaseAdmin
        .from("player_statistics")
        .select("player_id, total_goals, total_assists, yellow_cards, red_cards, blue_cards")
        .in("player_id", playerIds)
    : { data: [] as PlayerStatsRow[] };

  const totalsByPlayer = new Map<number, PlayerStatsRow>();
  for (const r of (statsRows ?? []) as PlayerStatsRow[]) totalsByPlayer.set(r.player_id, r);

  // 5) Matches + awards
  const { data: mps } = playerIds.length
    ? await supabaseAdmin
        .from("match_player_stats")
        .select("player_id, match_id, mvp, best_goalkeeper")
        .in("player_id", playerIds)
    : { data: [] as MPSRow[] };

  const matchesByPlayer = new Map<number, Set<number>>();
  const mvpByPlayer = new Map<number, number>();
  const gkByPlayer = new Map<number, number>();

  for (const r of (mps ?? []) as MPSRow[]) {
    if (!matchesByPlayer.has(r.player_id)) matchesByPlayer.set(r.player_id, new Set());
    matchesByPlayer.get(r.player_id)!.add(r.match_id);
    if (r.mvp) mvpByPlayer.set(r.player_id, (mvpByPlayer.get(r.player_id) ?? 0) + 1);
    if (r.best_goalkeeper)
      gkByPlayer.set(r.player_id, (gkByPlayer.get(r.player_id) ?? 0) + 1);
  }

  // 6) Build client payload (pre-sign each player's photo on the server)
  const now = new Date();
  const enriched: PlayerLite[] = await Promise.all(
    p.map(async (pl) => {
      const age =
        pl.birth_date
          ? Math.floor(
              (now.getTime() - new Date(pl.birth_date).getTime()) /
                (365.25 * 24 * 3600 * 1000)
            )
          : null;

      const team_id = currentTeamIdByPlayer.get(pl.id) ?? null;
      const team = team_id ? teamMap[team_id] ?? null : null;

      const totals = totalsByPlayer.get(pl.id);
      const matches = matchesByPlayer.get(pl.id)?.size ?? 0;
      const mvp = mvpByPlayer.get(pl.id) ?? 0;
      const best_gk = gkByPlayer.get(pl.id) ?? 0;

      const signedPhoto =
        (await signIfStoragePath(pl.photo)) ?? "/player-placeholder.jpg";

      return {
        id: pl.id,
        first_name: pl.first_name ?? "",
        last_name: pl.last_name ?? "",
        photo: signedPhoto,
        position: pl.position ?? "",
        height_cm: pl.height_cm ?? null,
        age,
        team: team ? { id: team_id!, name: team.name, logo: team.logo } : null,
        matches,
        goals: totals?.total_goals ?? 0,
        assists: totals?.total_assists ?? 0,
        yellow_cards: totals?.yellow_cards ?? 0,
        red_cards: totals?.red_cards ?? 0,
        blue_cards: totals?.blue_cards ?? 0,
        mvp,
        best_gk,
      };
    })
  );

  return (
    <div className="min-h-[100svh] bg-black">
      <div className="w-full">
        <PlayersClient initialPlayers={enriched} />
      </div>
    </div>
  );
}
