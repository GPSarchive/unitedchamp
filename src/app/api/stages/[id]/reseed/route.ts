import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseRouteClient } from "@/app/lib/supabase/supabaseServer";

export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

/** Service role client (server-only) */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Id = number;

type StageRow = {
  id: Id;
  tournament_id: Id;
  name: string;
  kind: "league" | "groups" | "knockout";
  ordering: number;
  config: any;
};

type MatchRow = {
  id: Id;
  stage_id: Id | null;
  matchday: number | null;
  round: number | null;
  bracket_pos: number | null;
  team_a_id: Id | null;
  team_b_id: Id | null;
  status: "scheduled" | "finished";
  home_source_round: number | null;
  home_source_bracket_pos: number | null;
  away_source_round: number | null;
  away_source_bracket_pos: number | null;
  // Optional if you want to send scores back
  team_a_score?: number | null;
  team_b_score?: number | null;
};

//
// Lightweight, local versions of the “progression” helpers we need
//

/** Do we already have standings for this stage? */
async function hasStandings(stageId: Id): Promise<boolean> {
  const { data } = await supabase
    .from("stage_standings")
    .select("stage_id")
    .eq("stage_id", stageId)
    .limit(1);
  return !!(data && data.length);
}

/** Recompute standings (3-1-0) for groups/league, using FINISHED matches only */
async function recomputeStandings(stageId: Id) {
  const { data: stage } = await supabase
    .from("tournament_stages")
    .select("*")
    .eq("id", stageId)
    .single<StageRow>();
  if (!stage || stage.kind === "knockout") return;

  const { data: ms } = await supabase
    .from("matches")
    .select("*")
    .eq("stage_id", stageId)
    .eq("status", "finished");

  type Stat = {
    played: number; won: number; drawn: number; lost: number; gf: number; ga: number; points: number;
  };

  const buckets = new Map<number, any[]>();
  (ms ?? []).forEach((m: any) => {
    const gid = m.group_id ?? 0;
    if (!buckets.has(gid)) buckets.set(gid, []);
    buckets.get(gid)!.push(m);
  });

  for (const [gid, list] of buckets.entries()) {
    const stats = new Map<Id, Stat>();
    const bump = (team: Id, d: Partial<Stat>) => {
      const s = stats.get(team) || { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 };
      for (const k of Object.keys(d) as (keyof Stat)[]) (s[k] as number) += (d[k] as number);
      stats.set(team, s);
    };

    for (const mm of list) {
      const A = mm.team_a_id, B = mm.team_b_id;
      if (!A || !B) continue;
      const as = mm.team_a_score ?? 0, bs = mm.team_b_score ?? 0;
      bump(A, { played: 1, gf: as, ga: bs });
      bump(B, { played: 1, gf: bs, ga: as });
      if (as > bs) { bump(A, { won: 1, points: 3 }); bump(B, { lost: 1 }); }
      else if (bs > as) { bump(B, { won: 1, points: 3 }); bump(A, { lost: 1 }); }
      else { bump(A, { drawn: 1, points: 1 }); bump(B, { drawn: 1, points: 1 }); }
    }

    const ranked = [...stats.entries()]
      .map(([team_id, s]) => ({ team_id, gd: s.gf - s.ga, ...s }))
      .sort((a, b) => b.points - a.points || (b.gd) - (a.gd) || b.gf - a.gf || (a.team_id - b.team_id))
      .map((r, i) => ({ ...r, rank: i + 1 }));

    await supabase.from("stage_standings").delete().eq("stage_id", stageId).eq("group_id", gid);
    if (ranked.length) {
      await supabase.from("stage_standings").insert(
        ranked.map(r => ({
          stage_id: stageId,
          group_id: gid,
          team_id: r.team_id,
          played: r.played, won: r.won, drawn: r.drawn, lost: r.lost,
          gf: r.gf, ga: r.ga, gd: r.gd, points: r.points, rank: r.rank,
        }))
      );
    }
  }
}

/** Fetch matches for a stage (for client hydration) */
async function listStageMatches(stageId: Id) {
  const { data } = await supabase
    .from("matches")
    .select(`
      id, stage_id, matchday, round, bracket_pos, status,
      team_a_id, team_b_id,
      team_a_score, team_b_score,
      home_source_round, home_source_bracket_pos,
      away_source_round, away_source_bracket_pos
    `)
    .eq("stage_id", stageId)
    .order("round", { ascending: true, nullsFirst: true })
    .order("bracket_pos", { ascending: true, nullsFirst: true })
    .order("matchday", { ascending: true, nullsFirst: true })
    .order("id", { ascending: true });

  return (data ?? []) as MatchRow[];
}

/** Normalize Next.js ctx.params across 14/15 */
async function readParams(ctx: any): Promise<{ id: string }> {
  const raw = ctx?.params;
  if (raw && typeof raw.then === "function") {
    return await raw;
  }
  return raw as { id: string };
}

/** Next.js App Router route handler */
export async function POST(
  req: NextRequest,
  ctx: any // compatible with 14 & 15; normalized via readParams()
) {
  try {
    // Authentication and authorization check
    const supa = await createSupabaseRouteClient();
    const {
      data: { user },
      error: userErr,
    } = await supa.auth.getUser();
    if (userErr || !user) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const roles = Array.isArray(user.app_metadata?.roles) ? user.app_metadata.roles : [];
    if (!roles.includes("admin")) {
      return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
    }

    const { id } = await readParams(ctx);
    const koStageId = Number(id);
    if (!Number.isFinite(koStageId)) {
      return NextResponse.json({ ok: false, error: "Invalid stage id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const wantReseed = /^(1|true)$/i.test(url.searchParams.get("reseed") ?? "");
    const force = /^(1|true)$/i.test(url.searchParams.get("force") ?? "");
    const recompute = /^(1|true)$/i.test(url.searchParams.get("recompute") ?? "");

    // Load KO stage (must be knockout)
    const { data: ko, error: koErr } = await supabase
      .from("tournament_stages")
      .select("*")
      .eq("id", koStageId)
      .single<StageRow>();
    if (koErr || !ko) {
      return NextResponse.json({ ok: false, error: koErr?.message || "KO stage not found" }, { status: 404 });
    }
    if (ko.kind !== "knockout") {
      return NextResponse.json({ ok: false, error: "Stage is not knockout" }, { status: 400 });
    }

    // Determine source stage id from ko.config
    const srcStageId: Id | null =
      ko.config?.from_stage_id ?? ko.config?.fromStageId ?? null;

    if (!srcStageId) {
      return NextResponse.json({
        ok: false,
        error:
          "KO config is missing from_stage_id. Save the tournament so stages get DB ids and config is normalized.",
      }, { status: 400 });
    }

    // Optionally recompute standings now (useful after deleting leftover matches)
    if (recompute || force) {
      await recomputeStandings(srcStageId);
    } else {
      // If nothing left but no standings yet, compute once so seeding can proceed
      const { data: srcMatches } = await supabase
        .from("matches")
        .select("status")
        .eq("stage_id", srcStageId);
      const noneLeft = (srcMatches?.length ?? 0) === 0;
      const haveStandings = await hasStandings(srcStageId);
      if (noneLeft && !haveStandings) {
        await recomputeStandings(srcStageId);
      }
    }

    // Decide source kind to call the appropriate seeder
    const { data: src } = await supabase
      .from("tournament_stages")
      .select("*")
      .eq("id", srcStageId)
      .single<StageRow>();
    if (!src) {
      return NextResponse.json({ ok: false, error: "Source stage not found" }, { status: 404 });
    }

    // Call the exported seeding functions from progression.ts
    const progression = await import("@/app/dashboard/tournaments/TournamentCURD/progression");

    if (src.kind === "groups") {
      await progression.seedNextKnockoutFromGroupsIfConfigured(srcStageId, { reseed: wantReseed || force });
    } else if (src.kind === "league") {
      await progression.seedNextKnockoutFromLeagueIfConfigured(srcStageId, { reseed: wantReseed || force });
    } else {
      return NextResponse.json({ ok: false, error: "Unsupported source kind for KO intake" }, { status: 400 });
    }

    // Return current matches in the KO stage (after seeding)
    const matches = await listStageMatches(koStageId);
    return NextResponse.json({ ok: true, matches });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Unexpected error" }, { status: 500 });
  }
}
