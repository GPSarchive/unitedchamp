// app/OMADES/page.tsx
import Link from "next/link";
import SearchBar from "@/app/OMADES/SearchBar";
import Pagination from "@/app/OMADES/Pagination";
import TeamCard from "@/app/OMADES/TeamCard";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import type { Team } from "@/app/lib/types";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";

// ───────────────────────────────────────────────────────────────────────
// Typography
// ───────────────────────────────────────────────────────────────────────
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

type SearchMap = { [key: string]: string | string[] | undefined };

type TeamWithCountRPC = {
  id: number;
  name: string;
  logo: string | null;
  colour: string | null;
  total_count: number;
};

const pad2 = (n: number | string) => String(n).padStart(2, "0");

// ───────────────────────────────────────────────────────────────────────
// Atmosphere
// ───────────────────────────────────────────────────────────────────────
function PaperBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
        }}
      />
      <div
        className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
        }}
      />
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.04]"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="omadesgrid"
            width="48"
            height="48"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 48 0 L 0 0 0 48"
              fill="none"
              stroke="#F3EFE6"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#omadesgrid)" />
      </svg>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page shell
// ───────────────────────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#fb923c] selection:text-[#0a0a14]`}
    >
      <PaperBackground />
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page header
// ───────────────────────────────────────────────────────────────────────
function PageHeader({ total }: { total: number }) {
  return (
    <header className="relative border-b-2 border-[#F3EFE6]/20">
      <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-6 md:pt-10 md:pb-8">
        <nav className="mb-4 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          <Link href="/" className="hover:text-[#fb923c] transition-colors">
            Αρχική
          </Link>
          <span>/</span>
          <span className="text-[#F3EFE6]">Ομάδες</span>
        </nav>

        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
              <span className="h-[2px] w-8 bg-[#fb923c]" />
              Μητρώο
            </div>
            <h1
              className="mt-2 font-[var(--f-display)] font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
              style={{ fontSize: "clamp(2.25rem, 5.5vw, 4rem)" }}
            >
              Οι Ομάδες
            </h1>
          </div>
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70">
            <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2.5 py-1">
              Σύνολο · {pad2(total)}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Empty / error states
// ───────────────────────────────────────────────────────────────────────
function StateBlock({
  kicker,
  title,
  body,
}: {
  kicker: string;
  title: string;
  body: string;
}) {
  return (
    <div
      className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center"
      style={{ background: "rgba(19,19,29,0.4)" }}
    >
      <div className="mx-auto max-w-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          / 00 · {kicker}
        </span>
        <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">
          {title}
        </p>
        <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
          {body}
        </p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Colophon
// ───────────────────────────────────────────────────────────────────────
function Colophon({ total }: { total: number }) {
  return (
    <footer className="border-t-2 border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]">
      <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
          Σύνολο ομάδων · {pad2(total)}
        </p>
        <Link
          href="/"
          className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] hover:bg-[#F3EFE6] hover:text-[#0a0a14] transition-colors"
        >
          ← Επιστροφή στην Αρχική
        </Link>
      </div>
    </footer>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Page
// ───────────────────────────────────────────────────────────────────────
export default async function TeamsPage({
  searchParams,
}: {
  searchParams: Promise<SearchMap>;
}) {
  const sp = await searchParams;

  const pageParamRaw = Array.isArray(sp.page) ? sp.page[0] : sp.page ?? "1";
  const parsedPage = Number.parseInt(pageParamRaw, 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const search = Array.isArray(sp.search) ? sp.search[0] : sp.search ?? "";

  const limit = 16;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let teams: Team[] = [];
  let count = 0;
  let error: { message?: string } | null = null;

  if (search) {
    const { data: teamsData, error: rpcError } = await supabaseAdmin.rpc(
      "search_teams_fuzzy",
      { search_term: search, page_limit: limit, page_offset: from }
    );
    error = rpcError as any;
    if (!error && teamsData) {
      const rows = teamsData as TeamWithCountRPC[];
      teams = rows.map((row) => ({
        id: row.id,
        name: row.name,
        logo: row.logo,
        colour: row.colour,
        created_at: null,
        am: null,
        season_score: null,
      }));
      count = rows.length > 0 ? rows[0].total_count : 0;
    }
  } else {
    const { data, error: queryError, count: queryCount } = await supabaseAdmin
      .from("teams")
      .select("id, name, logo, colour, created_at, am, season_score", {
        count: "exact",
      })
      .is("deleted_at", null)
      .order("name", { ascending: true })
      .range(from, to);
    error = queryError as any;
    if (!error && data) {
      teams = data as Team[];
      count = queryCount || 0;
    }
  }

  const totalPages = Math.max(1, Math.ceil(count / limit));

  return (
    <Shell>
      <PageHeader total={count} />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 py-10 md:py-14">
          {/* Controls */}
          <div className="mb-8 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <SearchBar initialSearch={search} />
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
              <span>
                {pad2(teams.length)} / {pad2(count)} ομάδες
              </span>
              {search && (
                <span className="border border-[#F3EFE6]/20 bg-[#13131d] px-2 py-0.5 text-[#F3EFE6]/70">
                  « {search} »
                </span>
              )}
            </div>
          </div>

          {/* Results */}
          {error ? (
            <StateBlock
              kicker="Σφάλμα"
              title="Η φόρτωση απέτυχε"
              body={`Σφάλμα φόρτωσης ομάδων: ${error.message ?? "άγνωστο"}`}
            />
          ) : teams.length === 0 ? (
            <StateBlock
              kicker={search ? "Φίλτρα" : "Κατάλογος"}
              title={
                search
                  ? "Κανένα αποτέλεσμα"
                  : "Δεν υπάρχουν ομάδες"
              }
              body={
                search
                  ? "Δοκιμάστε άλλους όρους αναζήτησης."
                  : "Αναμείνατε — το μητρώο ενημερώνεται."
              }
            />
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
              {teams.map((team, i) => (
                <TeamCard key={team.id} team={team} index={i} />
              ))}
            </div>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            search={search}
          />
        </div>
      </section>

      <Colophon total={count} />
    </Shell>
  );
}
