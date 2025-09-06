import TeamsGrid from "@/app/components/OMADESPageComponents/TeamsGrid";
import SearchBar from "@/app/components/OMADESPageComponents/SearchBar";
import Pagination from "@/app/components/OMADESPageComponents/Pagination";
import { supabaseAdmin } from "@/app/lib/supabaseAdmin";
import { Team } from "@/app/lib/types";

type SearchMap = { [key: string]: string | string[] | undefined };

// RPC row shape returned by search_teams_fuzzy
type TeamWithCountRPC = {
  id: number;
  name: string;
  logo: string | null;
  total_count: number;
};

// TeamsGrid expects logo: string (non-null) and no created_at
type GridTeam = { id: number; name: string; logo: string };

export default async function TeamsPage({
  searchParams,
}: {
  // Next.js 15: searchParams is a Promise
  searchParams: Promise<SearchMap>;
}) {
  const sp = await searchParams;

  // Safely extract values that might be string | string[] | undefined
  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "1";
  const page = Number.parseInt(pageParam, 10) > 0 ? Number.parseInt(pageParam, 10) : 1;

  const search = Array.isArray(sp.search) ? sp.search[0] : sp.search ?? "";

  const limit = 14;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let teams: Team[] = [];
  let count = 0;
  let error: any = null;

  if (search) {
    const { data: teamsData, error: rpcError } = await supabaseAdmin.rpc(
      "search_teams_fuzzy",
      { search_term: search, page_limit: limit, page_offset: from }
    );
    error = rpcError;
    if (!error && teamsData) {
      const rows = teamsData as TeamWithCountRPC[];
      teams = rows.map((row) => ({
        id: row.id,
        name: row.name,
        logo: row.logo,          // string | null (allowed in shared Team)
        created_at: null,        // RPC doesn't return it; keep null
      }));
      count = rows.length > 0 ? rows[0].total_count : 0;
    }
  } else {
    const query = supabaseAdmin
      .from("teams")
      .select("id, name, logo, created_at", { count: "exact" }) // ✅ include created_at
      .order("name", { ascending: true });

    const { data, error: queryError, count: queryCount } = await query.range(from, to);
    error = queryError;
    if (!error && data) {
      teams = data as Team[]; // matches shared Team
      count = queryCount || 0;
    }
  }

  if (error || !teams) {
    return (
      <div className="min-h-screen bg-zinc-950 [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:18px_18px] overflow-x-hidden">
        <div className="container mx-auto px-6 pt-6">
          <h1 className="text-4xl font-extrabold mb-8 text-center text-white/90 tracking-tight">
            Football Teams
          </h1>
          <SearchBar initialSearch={search} />
        </div>
        <div className="container mx-auto px-6 pb-10">
          <p className="text-center text-red-400">
            Error loading teams: {error?.message}
          </p>
        </div>
      </div>
    );
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 [background-image:radial-gradient(rgba(255,255,255,.06)_1px,transparent_1px)] [background-size:18px_18px] overflow-x-hidden">
        <div className="container mx-auto px-6 pt-6">
          <h1 className="text-4xl font-extrabold mb-8 text-center text-white/90 tracking-tight">
            Football Teams
          </h1>
          <SearchBar initialSearch={search} />
        </div>
        <div className="container mx-auto px-6 pb-10">
          <p className="text-center text-gray-400 mt-6">
            No teams found matching your search.
          </p>
        </div>
      </div>
    );
  }

  const totalPages = Math.ceil(count / limit);

  // ✅ Adapt to TeamsGrid's stricter shape (logo must be a string)
  const teamsForGrid: GridTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo ?? "", // fallback to empty string if null
  }));

  return (
    <div className="min-h-screen bg-grid-18">
      <div className="container mx-auto px-6 pt-6">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-white/90 tracking-tight">
          Football Teams
        </h1>
        <SearchBar initialSearch={search} />
      </div>

      <section className="mx-[calc(50%-50vw)] w-screen">
        <div className="px-6">
          <TeamsGrid teams={teamsForGrid} />
        </div>
      </section>

      <div className="container mx-auto px-6 pb-10">
        <Pagination currentPage={page} totalPages={totalPages} search={search} />
      </div>
    </div>
  );
}
