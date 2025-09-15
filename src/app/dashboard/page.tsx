// src/app/dashboard/page.tsx
import { createSupabaseRSCClient } from "@/app/lib/supabaseServer";
import UsersTable from "@/app/components/DashboardPageComponents/UsersTable";
import AdminPlayersCRUD from "@/app/components/DashboardPageComponents/players/AdminPlayersCRUD";
import MatchesDashboard from "@/app/components/DashboardPageComponents/MatchesDashboard";
import AdminTeamsSection from "@/app/components/DashboardPageComponents/AdminTeamsSection";
import AnnouncementsAdmin from "@/app/components/DashboardPageComponents/announcements/AnnouncementsAdmin";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { redirect } from "next/navigation";

// Wizard + server helper
import TournamentWizard from "@/app/components/DashboardPageComponents/TournamentCURD/TournamentWizard";
import { getTournamentForEditAction } from "@/app/components/DashboardPageComponents/TournamentCURD/actions";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string | string[];
    q?: string | string[];
    tid?: string | string[];
  }>;
}) {
  const supabase = await createSupabaseRSCClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/dashboard");

  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes("admin")) redirect("/403");

  const sp = await searchParams;
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const qParam = Array.isArray(sp.q) ? sp.q[0] : sp.q;
  const tidParam = Array.isArray(sp.tid) ? sp.tid[0] : sp.tid;

  const selectedTid = tidParam ? Number(tidParam) : null;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10));
  const q = (qParam ?? "").trim();

  // --- Server-side reads with service role (bypass RLS) ---
  const { data: teams, error: teamErr } = await supabaseAdmin
    .from("teams")
    .select("id, name, logo")
    .order("name", { ascending: true });

  // ✅ Correct select for matches: use real DB columns + PostgREST alias joins
  const { data: matchesWithJoins, error: matchErr } = await supabaseAdmin
    .from("matches")
    .select(
      `
      id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
      tournament_id, stage_id, group_id, matchday, round, bracket_pos,
      team_a:team_a_id (id, name, logo),
      team_b:team_b_id (id, name, logo),
      tournament:tournament_id (id, name),
      stage:stage_id (id, name, kind),
      grp:group_id (id, name)
    `
    )
    .order("match_date", { ascending: true });

  if (teamErr) console.error("[dashboard/page] teams error", teamErr);
  if (matchErr) console.error("[dashboard/page] matches error", matchErr);

  // Map snake-joined keys to the camel keys your UI expects.
  const initialMatches = (matchesWithJoins ?? []).map(
    ({ team_a, team_b, ...rest }: any) => ({
      ...rest,
      teamA: team_a ?? null,
      teamB: team_b ?? null,
    })
  );

  const initialTeams = teams ?? [];

  // ✅ Tournaments list (schema has no updated_at; use created_at in label)
  const { data: tournamentsList, error: tournamentsErr } = await supabaseAdmin
    .from("tournaments")
    .select("id, name, slug, created_at")
    .order("created_at", { ascending: false });

  if (tournamentsErr) console.error("[dashboard/page] tournaments error", tournamentsErr);

  // If a tournament is selected (?tid=...), load full editor data
  let editorData:
    | {
        payload: any;
        teams: Array<{
          id: number;
          seed?: number;
          groupsByStage?: Record<string, number | undefined>;
        }>;
        draftMatches: any[];
        meta: { id: number; slug: string | null; updated_at: string; created_at: string };
      }
    | null = null;

  if (selectedTid && Number.isFinite(selectedTid)) {
    const res = await getTournamentForEditAction(selectedTid);
    if (res.ok) editorData = res.data as any;
    else console.error("[dashboard/page] getTournamentForEditAction error", res.error);
  }

  // 🔧 Normalizer: convert editorData.teams into TeamDraft[] for the Wizard
  function toWizardTeams(
    src:
      | Array<{
          id: number;
          seed?: number;
          groupsByStage?: Record<string, number | undefined>;
        }>
      | null
      | undefined
  ) {
    return (src ?? []).map((t) => {
      const gbs = t.groupsByStage;
      let groupsByStage: Record<number, number | null> | undefined = undefined;
      if (gbs && typeof gbs === "object") {
        groupsByStage = Object.fromEntries(
          Object.entries(gbs).map(([k, v]) => [
            Number(k),
            v == null ? null : Number(v),
          ])
        ) as Record<number, number | null>;
      }
      return {
        id: Number(t.id),
        seed: t.seed ?? null,
        groupsByStage,
      };
    });
  }

  const wizardInitialTeams = editorData ? toWizardTeams(editorData.teams) : undefined;

  return (
    <main className="p-6 space-y-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <form method="post" action="/api/auth/sign-out">
          <button type="submit" className="px-3 py-1.5 rounded border border-white/20">
            Sign out
          </button>
        </form>
      </header>

      <p>Welcome, {user.email}</p>

      <form method="get" className="flex gap-2 my-4">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search by email"
          className="flex-1 px-2 py-1.5 rounded border border-white/20 bg-transparent"
        />
        <input type="hidden" name="page" value="1" />
        <button type="submit" className="px-3 py-1.5 rounded border border-white/20">
          Search
        </button>
      </form>

      <UsersTable page={page} perPage={50} q={q} />

      {/* Hydrate MatchesDashboard with server-fetched data */}
      <MatchesDashboard initialTeams={initialTeams} initialMatches={initialMatches} />

      <AdminTeamsSection />

      <div className="p-6">
        <h1 className="text-xl font-semibold text-white mb-4">Players</h1>
        <AdminPlayersCRUD />
        <AnnouncementsAdmin />
      </div>

      {/* ---------------------------- */}
      {/* Tournaments section with PICKER */}
      {/* ---------------------------- */}
      <section className="space-y-4">
        <h2 className="text-xl font-semibold text-white">Tournaments</h2>

        {/* Simple GET form to choose tournament; reloads the page with ?tid=... */}
        <form method="get" className="flex items-center gap-2">
          {/* Keep existing q/page in the URL when you switch tournaments */}
          <input type="hidden" name="q" value={q} />
          <input type="hidden" name="page" value={String(page)} />

          <select
            name="tid"
            defaultValue={selectedTid ?? ""}
            className="min-w-[18rem] px-3 py-2 rounded border border-white/20 bg-transparent"
          >
            <option value="">➕ New tournament…</option>
            {(tournamentsList ?? []).map((t) => {
              const labelWhen = t.created_at
                ? new Date(t.created_at).toLocaleString()
                : "—";
              return (
                <option key={t.id} value={t.id}>
                  {t.name} {t.slug ? `(${t.slug})` : ""} — created {labelWhen}
                </option>
              );
            })}
          </select>

          <button type="submit" className="px-3 py-2 rounded border border-white/20">
            Load
          </button>

          {selectedTid ? (
            <a
              className="px-3 py-2 rounded border border-white/20"
              href="/dashboard?tid="
              title="Start a new tournament"
            >
              Start new
            </a>
          ) : null}
        </form>

        {/* Render the wizard in edit or create mode */}
        <div className="mt-4">
          {editorData ? (
            <TournamentWizard
              mode="edit"
              meta={editorData.meta}
              initialPayload={editorData.payload}
              initialTeams={wizardInitialTeams}
              initialDraftMatches={editorData.draftMatches}
            />
          ) : (
            <TournamentWizard mode="create" />
          )}
        </div>
      </section>
    </main>
  );
}
