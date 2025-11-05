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
        colors={["#FFD700", "#E6BE00", "#B38600"]}
        rotation={0.5}
        speed={0.2}
        scale={3}
        frequency={1.5}
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
        <h1 className="text-5xl font-extrabold mb-4 text-center text-white tracking-tight">
          Ο Μ Α Δ Ε Σ
        </h1>
        <p className="text-center text-white/60 mb-8 text-sm tracking-wide">
          {count} {count === 1 ? 'Team' : 'Teams'} Available
        </p>
        <SearchBar initialSearch={search} />
      </div>

      <section className="mx-[calc(50%-50vw)] w-screen py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {teamsForGrid.map((team) => (
              <a
                key={team.id}
                href={`/OMADES/teams/${team.id}`}
                className="group relative aspect-square
                         bg-black rounded-lg
                         border border-white/5
                         shadow-[inset_0_1px_1px_rgba(255,255,255,0.03),0_8px_16px_rgba(0,0,0,0.6)]
                         hover:bg-gradient-to-br hover:from-[#FFD700]/10 hover:to-[#B38600]/5
                         hover:border-[#FFD700]/30
                         hover:shadow-[inset_0_1px_1px_rgba(255,215,0,0.1),0_12px_24px_rgba(255,215,0,0.15)]
                         active:scale-[0.97]
                         transition-all duration-200 ease-out
                         cursor-pointer overflow-hidden"
              >
                {/* Content wrapper */}
                <div className="relative w-full h-full flex flex-col items-center justify-between p-4 sm:p-5">
                  
                  {/* Logo - centered and larger */}
                  <div className="flex-1 flex items-center justify-center w-full">
                    {team.logo ? (
                      <img
                        src={team.logo}
                        alt={`${team.name} logo`}
                        className="w-full h-full max-w-[80%] max-h-[80%] object-contain 
                                 transition-transform duration-200 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full 
                                    bg-gradient-to-br from-[#FFD700] to-[#B38600] 
                                    flex items-center justify-center text-white font-bold text-3xl sm:text-4xl
                                    transition-transform duration-200 group-hover:scale-105">
                        {team.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                  
                  {/* Bottom section: Name and Arrow */}
                  <div className="w-full flex items-end justify-between gap-2">
                    {/* Team name - bottom center */}
                    <h3 className="flex-1 text-center text-xs sm:text-sm font-medium text-white/80 
                                 group-hover:text-white
                                 transition-colors duration-200 
                                 line-clamp-2 leading-tight">
                      {team.name}
                    </h3>
                    
                    {/* Arrow - bottom right */}
                    <div className="flex-shrink-0 text-white/30 group-hover:text-[#FFD700] 
                                  transition-all duration-200 group-hover:translate-x-0.5 group-hover:translate-y-0.5">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="w-3 h-3 sm:w-4 sm:h-4">
                        <path d="M3 13L13 3M13 3H5M13 3V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="container mx-auto px-6 pb-10">
        <Pagination currentPage={page} totalPages={totalPages} search={search} />
      </div>
    </Shell>
  );
}