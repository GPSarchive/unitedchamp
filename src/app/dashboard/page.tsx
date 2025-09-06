// src/app/dashboard/page.tsx
import { createSupabaseRSCClient } from '@/app/lib/supabaseServer';
import UsersTable from '@/app/components/DashboardPageComponents/UsersTable';
import AdminPlayersCRUD from '@/app/components/DashboardPageComponents/players/AdminPlayersCRUD';
import MatchesDashboard from '@/app/components/DashboardPageComponents/MatchesDashboard';
import AdminTeamsSection from '@/app/components/DashboardPageComponents/AdminTeamsSection';
import AnnouncementsAdmin from "@/app/components/DashboardPageComponents/announcements/AnnouncementsAdmin";
import { supabaseAdmin } from '@/app/lib/supabaseAdmin';
import { redirect } from 'next/navigation';
import TournamentWizard from '@/app/components/DashboardPageComponents/TournamentCURD/TournamentWizard';


export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[]; q?: string | string[] }>;
}) {
  const supabase = await createSupabaseRSCClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/dashboard');

  const roles = Array.isArray(user.app_metadata?.roles)
    ? (user.app_metadata!.roles as string[])
    : [];
  if (!roles.includes('admin')) redirect('/403');

  // Next 15: await dynamic APIs
  const sp = await searchParams;
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page;
  const qParam    = Array.isArray(sp.q)    ? sp.q[0]    : sp.q;

  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const q = (qParam ?? '').trim();

  // --- Server-side reads with service role (bypass RLS) ---
  const { data: teams, error: teamErr } = await supabaseAdmin
    .from('teams')
    .select('id, name, logo')
    .order('name', { ascending: true });

  const { data: matchesWithJoins, error: matchErr } = await supabaseAdmin
    .from('matches')
    .select(`
      id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
      team_a:team_a_id (id, name, logo),
      team_b:team_b_id (id, name, logo)
    `)
    .order('match_date', { ascending: true });

  if (teamErr) console.error('[dashboard/page] teams error', teamErr);
  if (matchErr) console.error('[dashboard/page] matches error', matchErr);

  // Normalize to teamA/teamB so the client keeps the same render code
  const initialMatches = (matchesWithJoins ?? []).map((m: any) => ({
    ...m,
    teamA: m.team_a ?? null,
    teamB: m.team_b ?? null,
  }));

  const initialTeams = teams ?? [];

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

      <AdminTeamsSection  />
      <div className="p-6">
      <h1 className="text-xl font-semibold text-white mb-4">Players</h1>
      <AdminPlayersCRUD />
      <AnnouncementsAdmin />
    </div>
    <div>
      <h1 className="text-xl font-semibold text-white mb-4">Tournaments</h1>
      <TournamentWizard />
    </div>
    </main>
  );
}