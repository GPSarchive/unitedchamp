// app/OMADES/teams/page.tsx 
import DotGrid from "@/app/OMADES/DotGrid";
import TeamsGrid from "@/app/OMADES/TeamsGrid";
import SearchBar from "@/app/OMADES/SearchBar";
import Pagination from "@/app/OMADES/Pagination";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import { Team } from "@/app/lib/types";
import React from "react";
import ColorBends from "./ColorBends";
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

// ---- Background shell (DotGrid behind, content above) ----
function Background() {
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <ColorBends
        colors={["#211", "#29", "#29"]}
        rotation={0}
        speed={0.2}
        scale={1.2}
        frequency={2.5}
        warpStrength={1}
        mouseInfluence={0}
        parallax={0}
        noise={0.1}
        transparent
      />
    </div>
  );
}


function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-dvh bg-black overflow-hidden">
      <Background />
      <div className="relative z-10">{children}</div>
    </main>
  );
}

export default async function TeamsPage({
  searchParams,
}: {
  // Next.js 15: searchParams is a Promise
  searchParams: Promise<SearchMap>;
}) {
  const sp = await searchParams;

  const pageParam = Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "1";
  const page =
    Number.parseInt(pageParam, 10) > 0 ? Number.parseInt(pageParam, 16) : 1;

  const search = Array.isArray(sp.search) ? sp.search[0] : sp.search ?? "";

  const limit = 16;
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
        logo: row.logo,
        created_at: null,
      }));
      count = rows.length > 0 ? rows[0].total_count : 0;
    }
  } else {
    const query = supabaseAdmin
      .from("teams")
      .select("id, name, logo, created_at", { count: "exact" })
      .order("name", { ascending: true });

    const { data, error: queryError, count: queryCount } = await query.range(
      from,
      to
    );
    error = queryError;
    if (!error && data) {
      teams = data as Team[];
      count = queryCount || 0;
    }
  }

  // ---- Error state ----
  if (error || !teams) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  // ---- Empty state ----
  if (teams.length === 0) {
    return (
      <Shell>
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
      </Shell>
    );
  }

  const totalPages = Math.ceil(count / limit);

  // ✅ Adapt to TeamsGrid's stricter shape (logo must be a string)
  const teamsForGrid: GridTeam[] = teams.map((t) => ({
    id: t.id,
    name: t.name,
    logo: t.logo ?? "",
  }));

  // ---- Success ----
  return (
    <Shell>
      <div className="container mx-auto px-6 pt-6">
        <h1 className="text-4xl font-extrabold mb-8 text-center text-white/90 tracking-tight">
          Ο Μ Α Δ Ε Σ
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
    </Shell>
  );
}
