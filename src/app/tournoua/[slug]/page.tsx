// app/tournoua/[slug]/page.tsx
import Image from "next/image";
import Link from "next/link";
import { createSupabaseRSCClient } from "@/app/lib/supabase/supabaseServer";
import { getTournamentBySlug, getStagesAndGroups, getStandingsForSlug } from "@/app/lib/repos/tournaments";

// Reused UI blocks
import StandingsTable from "./components/StandingsTable";
import FixturesByMatchday from "./components/FixturesByMatchday";
import BracketTree from "./components/BracketTree";
import PlayerRow from "./components/PlayerRow";

// Team views (prettier grouped layouts)
import TeamsLeagueList from "./components/teams/leauge/TeamsLeagueList";
import TeamsGroupsWithMatches from "./components/teams/groups/TeamsGroupsWithMatches";
import ModernKnockoutTree from "@/app/dashboard/tournaments/TournamentCURD/stages/KnockoutTree/oldknockout/ModernKnockoutTree";

export const revalidate = 60;

// Next.js 15: params & searchParams are Promises on pages
export default async function TournamentOnePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ [k: string]: string | string[] | undefined }>;
}) {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const pick = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

  const view = (pick(sp.view) ?? "overview") as
    | "overview"
    | "standings"
    | "fixtures"
    | "bracket"
    | "teams"
    | "players"
    | "history";

  const [tournament, sg] = await Promise.all([
    getTournamentBySlug(slug),
    getStagesAndGroups(slug),
  ]);
  if (!tournament) return <div className="p-6">Δεν βρέθηκε το τουρνουά.</div>;

  // stage/group/query helpers (page can read search params; layouts cannot)
  const stageId = Number(pick(sp.stage_id) ?? sg.stages[0]?.id ?? 0);
  const groupId = Number(pick(sp.group_id) ?? 0);
  const matchdayStr = pick(sp.matchday);
  const matchday =
    matchdayStr != null && matchdayStr !== "" && !Number.isNaN(Number(matchdayStr))
      ? Number(matchdayStr)
      : undefined;

  const s = await createSupabaseRSCClient();

  // Build query string for links preserving filters
  const buildQS = (next: Record<string, any>) => {
    const q = new URLSearchParams();
    const sid = next.stage_id ?? stageId;
    const gid = next.group_id ?? groupId;
    const v = next.view ?? view;
    if (v) q.set("view", String(v));
    if (sid) q.set("stage_id", String(sid));
    if (gid) q.set("group_id", String(gid));
    if (next.matchday != null && next.matchday !== "") q.set("matchday", String(next.matchday));
    return q.toString();
  };

  // Preload small, shared data
  const leagueStage = sg.stages.find((x: any) => x.kind === "league");
  const groupsStage = sg.stages.find((x: any) => x.kind === "groups");
  const knockoutStage = sg.stages.find((x: any) => x.kind === "knockout");

  // Conditional data fetching per tab to avoid over-fetching
  const [teamsRegs, standingsRows, fixturesMatches, bracketMatches, playerStats, awardsWinner] = await Promise.all([
    // Teams (used by multiple tabs, but keep it cheap)
    ["teams", "overview"].includes(view)
      ? s
          .from("tournament_teams")
          .select("id, seed, group_id, teams:team_id(id,name,logo)")
          .eq("tournament_id", tournament.id)
          .order("seed", { ascending: true })
          .order("id", { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),

    view === "standings"
      ? getStandingsForSlug(slug, { stageId, groupId })
      : Promise.resolve([]),

    view === "fixtures"
      ? (async () => {
          let q = s
            .from("matches")
            .select("id,match_date,team_a_id,team_b_id,team_a_score,team_b_score,status,matchday,round,bracket_pos,group_id")
            .eq("tournament_id", tournament.id)
            .eq("stage_id", stageId)
            .order("matchday", { ascending: true })
            .order("match_date", { ascending: true });
          if (groupId) q = q.eq("group_id", groupId);
          if (typeof matchday === "number") q = q.eq("matchday", matchday);
          const { data } = await q;
          return data ?? [];
        })()
      : Promise.resolve([]),

    view === "bracket" && knockoutStage
      ? s
          .from("matches")
          .select("id,team_a_id,team_b_id,team_a_score,team_b_score,status,round,bracket_pos")
          .eq("tournament_id", tournament.id)
          .eq("stage_id", stageId || knockoutStage.id)
          .order("round", { ascending: true })
          .order("bracket_pos", { ascending: true })
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),

    view === "players"
      ? s
          .from("v_tournament_player_stats")
          .select("*")
          .eq("tournament_id", tournament.id)
          .order(String(pick(sp.sort) ?? "goals") as any, { ascending: false })
          .limit(200)
          .then(({ data }) => data ?? [])
      : Promise.resolve([]),

    view === "history"
      ? Promise.all([
          s.from("tournament_awards").select("*").eq("tournament_id", tournament.id).maybeSingle(),
          tournament.winner_team_id
            ? s.from("teams").select("id,name,logo").eq("id", tournament.winner_team_id).maybeSingle()
            : Promise.resolve({ data: null as any }),
        ])
      : Promise.resolve([]),
  ] as const);

  // Derived maps
  const teams: { id: number; name: string; logo?: string | null; seed?: number | null; group_id?: number | null }[] =
    (teamsRegs ?? []).map((row: any) => ({
      id: row.teams?.id,
      name: row.teams?.name ?? "—",
      logo: row.teams?.logo ?? null,
      seed: row.seed ?? null,
      group_id: row.group_id ?? null,
    }));

  const teamsMap = Object.fromEntries(
    teams.map((tm) => [tm.id, { name: tm.name, logo: tm.logo, seed: tm.seed }])
  );

  // For fixtures/bracket team names
  const teamIds = Array.from(
    new Set(
      (fixturesMatches as any[]).flatMap((m) => [m.team_a_id, m.team_b_id]).concat(
        (bracketMatches as any[]).flatMap((m) => [m.team_a_id, m.team_b_id])
      )
    )
  ).filter(Boolean);

  const { data: teamsForMatches } = teamIds.length
    ? await s.from("teams").select("id,name").in("id", teamIds as number[])
    : { data: [] as any[] };
  const teamsNameMap = Object.fromEntries((teamsForMatches ?? []).map((t: any) => [t.id, { name: t.name }]));

  // Players/helpers
  const playerIds = (playerStats as any[]).map((r: any) => r.player_id);
  const uniquePids = Array.from(new Set(playerIds));
  const { data: players } = uniquePids.length
    ? await s.from("player").select("id,first_name,last_name").in("id", uniquePids)
    : { data: [] as any[] };
  const playersById = Object.fromEntries((players ?? []).map((p: any) => [p.id, p]));

  // History data
  const awards = Array.isArray(awardsWinner) ? awardsWinner[0]?.data : undefined;
  const winner = Array.isArray(awardsWinner) ? awardsWinner[1]?.data : undefined;
  const pname = (id?: number | null) => {
    const p = (players ?? []).find((x: any) => x.id === id);
    return p ? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() : null;
  };

  const tabs: { key: typeof view; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "standings", label: "Standings" },
    { key: "fixtures", label: "Αγωνιστικές" },
    { key: "bracket", label: "Bracket" },
    { key: "teams", label: "Ομάδες" },
    { key: "players", label: "Παίκτες" },
    { key: "history", label: "Ιστορικό" },
  ];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="px-4 sm:px-6 py-6 border-b border-white/10 bg-black/40">
        <div className="flex items-center gap-4">
          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-black/40">
            <Image src={tournament.logo || "/placeholder.png"} alt={tournament.name} fill className="object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold truncate">{tournament.name}</h1>
            <p className="text-white/70 text-sm sm:text-base">
              {tournament.season ?? "—"} • {String(tournament.format).toUpperCase()} • {tournament.status}
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-5 -mx-4 px-4 overflow-x-auto">
          <div className="flex gap-2 whitespace-nowrap">
            {tabs.map((t) => (
              <Link
                key={t.key}
                href={`/tournoua/${tournament.slug}?${buildQS({ view: t.key })}`}
                className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                  view === t.key
                    ? "border-white/80 bg-white/10"
                    : "border-white/15 hover:bg-white/10"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Filters (Stage/Group), shown where relevant */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-sm">Stage:</span>
            <div className="flex flex-wrap gap-2">
              {sg.stages.map((st: any) => (
                <Link
                  key={st.id}
                  href={`?${buildQS({ stage_id: st.id, group_id: 0 })}`}
                  className={`px-2 py-1 rounded border text-sm ${
                    stageId === st.id ? "border-white/80" : "border-white/20 hover:bg-white/10"
                  }`}
                >
                  {st.name} ({st.kind})
                </Link>
              ))}
            </div>
          </div>

          {!!(sg.groupsByStage[stageId]?.length) && (
            <div className="flex items-center gap-2">
              <span className="text-white/60 text-sm">Όμιλος:</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={`?${buildQS({ group_id: 0 })}`}
                  className={`px-2 py-1 rounded border text-sm ${
                    groupId ? "border-white/20 hover:bg-white/10" : "border-white/80"
                  }`}
                >
                  Όλοι
                </Link>
                {sg.groupsByStage[stageId].map((g: any) => (
                  <Link
                    key={g.id}
                    href={`?${buildQS({ group_id: g.id })}`}
                    className={`px-2 py-1 rounded border text-sm ${
                      groupId === g.id ? "border-white/80" : "border-white/20 hover:bg-white/10"
                    }`}
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-4 sm:px-6 py-6">
        {view === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Quick teams/standings snapshot */}
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold mb-3">Ομάδες</h3>
              {teams.length ? (
                <TeamsLeagueList teams={teams} title="" />
              ) : (
                <div className="text-white/60">Καμία ομάδα καταχωρημένη ακόμα.</div>
              )}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold mb-3">Γενική Εικόνα</h3>
              <p className="text-white/70 text-sm">Επέλεξε καρτέλα για λεπτομέρειες.</p>
            </section>
          </div>
        )}

        {view === "teams" && (
          <div className="space-y-8">
            {tournament.format === "groups" && groupsStage ? (
              <TeamsGroupsWithMatches
                title="Όμιλοι"
                groups={sg.groupsByStage[groupsStage.id] ?? []}
                teams={teams}
                matches={[]}
                teamsMap={teamsMap}
              />
            ) : tournament.format === "knockout" && knockoutStage ? (
              <ModernKnockoutTree title="Bracket" matches={[]} teamsMap={teamsMap as any} />
            ) : tournament.format === "mixed" ? (
              <>
                {groupsStage && (
                  <TeamsGroupsWithMatches
                    title="Group Stage"
                    groups={sg.groupsByStage[groupsStage.id] ?? []}
                    teams={teams}
                    matches={[]}
                    teamsMap={teamsMap}
                  />
                )}
                {knockoutStage && (
                  <ModernKnockoutTree title="Knockout Bracket" matches={[]} teamsMap={teamsMap as any} />
                )}
                {!groupsStage && !knockoutStage && <TeamsLeagueList teams={teams} title="Ομάδες" />}
              </>
            ) : (
              <TeamsLeagueList teams={teams} title={leagueStage ? "Ομάδες" : "Ομάδες"} />
            )}
          </div>
        )}

        {view === "standings" && (
          <StandingsTable rows={standingsRows as any} teams={Object.fromEntries(teams.map((t) => [t.id, { name: t.name, logo: t.logo }]))} />
        )}

        {view === "fixtures" && (
          <FixturesByMatchday matches={(fixturesMatches ?? []) as any} teams={teamsNameMap} />
        )}

        {view === "bracket" && (
          !bracketMatches || (bracketMatches as any[]).length === 0 ? (
            <div className="text-white/60">Δεν υπάρχει πρόγραμμα Bracket για αυτό το stage.</div>
          ) : (
            <BracketTree matches={(bracketMatches ?? []) as any} teams={teamsNameMap} />
          )
        )}

        {view === "players" && (
          <div>
            <div className="flex gap-2 mb-4 text-sm overflow-x-auto">
              {([
                ["goals", "Goals"],
                ["assists", "Assists"],
                ["mvp_count", "MVP"],
                ["best_gk_count", "Best GK"],
                ["yellow_cards", "Yellow"],
                ["red_cards", "Red"],
                ["blue_cards", "Blue"],
              ] as const).map(([key, label]) => (
                <Link
                  key={key}
                  href={`?${buildQS({ sort: key })}`}
                  className={`px-2 py-1 rounded border ${
                    (pick(sp.sort) ?? "goals") === key ? "border-white/80" : "border-white/20 hover:bg-white/10"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>

            <table className="w-full text-sm border-separate border-spacing-y-2">
              <thead className="text-white/70">
                <tr>
                  <th className="text-left px-2">Παίκτης</th>
                  {([
                    ["goals", "Goals"],
                    ["assists", "Assists"],
                    ["mvp_count", "MVP"],
                    ["best_gk_count", "Best GK"],
                    ["yellow_cards", "Yellow"],
                    ["red_cards", "Red"],
                    ["blue_cards", "Blue"],
                  ] as const).map(([key, label]) => (
                    <th key={key} className={`text-right px-2 ${(pick(sp.sort) ?? "goals") === key ? "underline" : ""}`}>
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(playerStats as any[]).map((r: any) => (
                  <PlayerRow
                    key={r.player_id}
                    player={{
                      id: r.player_id,
                      first_name: playersById[r.player_id]?.first_name,
                      last_name: playersById[r.player_id]?.last_name,
                    }}
                    stats={r}
                  />
                ))}
                {(!playerStats || (playerStats as any[]).length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-2 py-4 text-center text-white/60">
                      Δεν υπάρχουν στατιστικά.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {view === "history" && (
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold mb-2">Νικήτρια Ομάδα</h3>
              {winner ? <div className="text-white/90">{winner.name}</div> : <div className="text-white/60">—</div>}
            </section>

            <section className="rounded-xl border border-white/10 bg-white/5 p-4">
              <h3 className="text-lg font-semibold mb-2">Βραβεία / Μονολεκτικά στατιστικά</h3>
              <ul className="space-y-1 text-sm">
                <li>
                  <span className="text-white/70">Top Scorer: </span>
                  <span className="font-medium">{pname(awards?.top_scorer_id) ?? "—"}</span>
                  {awards?.top_scorer_goals != null && (
                    <span className="text-white/60"> ({awards.top_scorer_goals} γκολ)</span>
                  )}
                </li>
                <li>
                  <span className="text-white/70">MVP: </span>
                  <span className="font-medium">{pname(awards?.mvp_player_id) ?? "—"}</span>
                </li>
                <li>
                  <span className="text-white/70">Καλύτερος Τερματοφύλακας: </span>
                  <span className="font-medium">{pname(awards?.best_gk_player_id) ?? "—"}</span>
                </li>
              </ul>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
