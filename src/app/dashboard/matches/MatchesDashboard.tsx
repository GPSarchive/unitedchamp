"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase/supabaseClient";

import RowEditor from "./RowEditor";
import type {
  Id,
  TeamLite,
  MatchRow as BaseMatchRow,
  MaybeArray,
} from "@/app/lib/types";

// Extend the shared MatchRow with joined objects (and a few optional meta columns)
export type MatchRow = BaseMatchRow & {
  teamA?: MaybeArray<TeamLite>;
  teamB?: MaybeArray<TeamLite>;
  tournament?: MaybeArray<{ id: Id; name: string }>;
  stage?: MaybeArray<{ id: Id; name: string; kind: "league" | "groups" | "knockout" }>;
  grp?: MaybeArray<{ id: Id; name: string }>;
  tournament_id?: Id | null;
  stage_id?: Id | null;
  group_id?: Id | null;
  matchday?: number | null;
  round?: number | null;
  bracket_pos?: number | null;
  updated_at?: string | null;
};

type MatchesDashboardProps = {
  initialTeams?: TeamLite[];
  initialMatches?: MatchRow[];
  /** Comes from the parent (?tid=...) and is used to preselect the tournament filter */
  defaultTournamentId?: number | null;
};

// ===== Small helpers =====
function isoToDTString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function one<T>(v: MaybeArray<T> | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : ((v as unknown) as T | null) ?? null;
}

function teamLabel(t: TeamLite | null, fallbackId?: Id) {
  return t ? `${t.name} (#${t.id})` : `#${fallbackId ?? ""}`;
}

function stageLabel(r: MatchRow): string | null {
  const s = one(r.stage);
  const g = one(r.grp);
  const parts: string[] = [];
  if (s?.name) parts.push(s.name);
  if (g?.name) parts.push(g.name);
  if (typeof r.matchday === "number") parts.push(`MD ${r.matchday}`);
  if (typeof r.round === "number") parts.push(`R${r.round}`);
  if (typeof r.bracket_pos === "number") parts.push(`Pos ${r.bracket_pos}`);
  return parts.length ? parts.join(" • ") : null;
}

const PAGE_SIZE = 20;

export default function MatchesDashboard({
  initialTeams = [],
  initialMatches = [],
  defaultTournamentId = null,
}: MatchesDashboardProps) {
  const router = useRouter();

  // Local copies for client-side filter/sort and optimistic updates.
  const [teams, setTeams] = useState<TeamLite[]>(initialTeams);
  const [rows, setRows] = useState<MatchRow[]>(initialMatches);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filters & sorting
  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [teamQuery, setTeamQuery] = useState<string>("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "updated">("newest");

  // Pagination state
  const [page, setPage] = useState<number>(1);

  // Accessibility/visual option
  const [hiContrast, setHiContrast] = useState(false);

  // Keep local state in sync when the server re-hydrates with new data
  useEffect(() => setTeams(initialTeams), [initialTeams]);
  useEffect(() => setRows(initialMatches), [initialMatches]);

  // Initialize tournament filter from parent (?tid=...)
  useEffect(() => {
    if (defaultTournamentId != null) {
      setTournamentFilter(String(defaultTournamentId));
    }
  }, [defaultTournamentId]);

  // Reset to first page whenever filters, sort, or source rows change
  useEffect(() => {
    setPage(1);
  }, [tournamentFilter, teamQuery, sortMode, rows.length]);

  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingId),
    [rows, editingId]
  );

  async function refreshFromServer() {
    setIsRefreshing(true);
    setError(null);
    try {
      router.refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }

  async function remove(id: Id) {
    if (!confirm("Delete this match? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = (data as any)?.error ?? `HTTP ${res.status}`;
        const dbg =
          (data as any)?.__debug?.message ||
          (data as any)?.__debug?.details ||
          (data as any)?.__debug?.hint ||
          "";
        throw new Error(dbg ? `${base} — ${dbg}` : base);
      }

      // Optimistic update for snappy UX
      setRows((r) => r.filter((x) => x.id !== id));
      await refreshFromServer();
    } catch (e: any) {
      alert(e.message ?? String(e));
    }
  }

  async function testRlsCondition() {
    const { data, error } = await supabase.rpc("test_admin_role");
    if (error) console.error("RLS Test Error:", error);
    console.log("Is admin role present?:", data);
  }

  // Build distinct tournament options from rows
  const tournamentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      const t = one(r.tournament);
      if (t?.id != null) map.set(String(t.id), t.name ?? `Tournament #${t.id}`);
      else if (r.tournament_id != null)
        map.set(String(r.tournament_id), `Tournament #${r.tournament_id}`);
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [rows]);

  // Derive visible list (filter + sort)
  const displayRows = useMemo(() => {
    let out = [...rows];

    if (tournamentFilter !== "all") {
      out = out.filter((r) => {
        const tid = String(r.tournament_id ?? one(r.tournament)?.id ?? "");
        return tid === tournamentFilter;
      });
    }

    const q = teamQuery.trim().toLowerCase();
    if (q) {
      out = out.filter((r) => {
        const aName = (one<TeamLite>(r.teamA)?.name ?? "").toLowerCase();
        const bName = (one<TeamLite>(r.teamB)?.name ?? "").toLowerCase();
        return aName.includes(q) || bName.includes(q);
      });
    }

    out.sort((a, b) => {
      if (sortMode === "oldest") {
        const da = a.match_date ? Date.parse(a.match_date) : 0;
        const db = b.match_date ? Date.parse(b.match_date) : 0;
        return da - db;
      }
      if (sortMode === "newest") {
        const da = a.match_date ? Date.parse(a.match_date) : 0;
        const db = b.match_date ? Date.parse(b.match_date) : 0;
        return db - da;
      }
      const ua = a.updated_at ? Date.parse(a.updated_at) : 0;
      const ub = b.updated_at ? Date.parse(b.updated_at) : 0;
      return ub - ua;
    });

    return out;
  }, [rows, tournamentFilter, teamQuery, sortMode]);

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, page]);

  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm ${
      active
        ? "border-emerald-400/40 bg-emerald-700/30 text-white"
        : "border-white/15 bg-zinc-950 text-white hover:bg-zinc-900"
    }`;

  // Row styling helper: zebra + status accent + hover + optional high-contrast tones
  function rowClass(i: number, s: MatchRow["status"]) {
    return [
      "group relative transition-colors border-t border-white/8",
      // zebra base
      i % 2
        ? (hiContrast ? "bg-[#06070a]" : "bg-[#0b0b10]")
        : (hiContrast ? "bg-[#0d0f13]" : "bg-[#101215]"),
      // red hover/focus/active backgrounds
      "hover:bg-red-500/10 focus-within:bg-black-500/15 active:bg-red-500/20",
      // ensure base text goes full white
      "text-white/90 hover:text-white focus-within:text-white active:text-white",
      // also force child text/icons to white (overrides text-white/55 etc.)
      "hover:[&_svg]:text-white hover:[&_span]:text-white hover:[&_div]:text-white hover:[&_p]:text-white",
      "focus-within:[&_svg]:text-white focus-within:[&_span]:text-white focus-within:[&_div]:text-white",
      "active:[&_svg]:text-white active:[&_span]:text-white active:[&_div]:text-white",
      // status accent
      "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
      s === "finished" ? "before:bg-emerald-500/80" : "before:bg-zinc-400/40",
    ].join(" ");
  }

  function Pagination() {
    const canPrev = page > 1;
    const canNext = page < totalPages;

    return (
      <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gradient-to-r from-black to-zinc-950 border-t border-white/10">
        <div className="text-xs text-white/60">
          Showing{" "}
          <span className="text-white">
            {displayRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}
          </span>
          –<span className="text-white">{Math.min(page * PAGE_SIZE, displayRows.length)}</span> of
          <span className="text-white"> {displayRows.length}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(1)}
            disabled={!canPrev}
            className="inline-flex items-center px-2 py-1 rounded-md border border-white/15 bg-black/60 text-white disabled:opacity-40 hover:bg-black"
            aria-label="First page"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={!canPrev}
            className="inline-flex items-center px-2 py-1 rounded-md border border-white/15 bg-black/60 text-white disabled:opacity-40 hover:bg-black"
            aria-label="Previous page"
          >
            <ChevronLeft className="h-4 w-4" /> Prev
          </button>
          <span className="px-2 text-xs text-white/70">
            Page <span className="text-white">{page}</span> /{" "}
            <span className="text-white">{totalPages}</span>
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={!canNext}
            className="inline-flex items-center px-2 py-1 rounded-md border border-white/15 bg-black/60 text-white disabled:opacity-40 hover:bg-black"
            aria-label="Next page"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => setPage(totalPages)}
            disabled={!canNext}
            className="inline-flex items-center px-2 py-1 rounded-md border border-white/15 bg-black/60 text-white disabled:opacity-40 hover:bg-black"
            aria-label="Last page"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between rounded-xl border border-emerald-400/20 bg-gradient-to-r from-black via-zinc-950 to-black px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
        <h2 className="text-xl font-bold text-white tracking-wide">
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-300">
            Matches
          </span>
        </h2>
        <div className="flex gap-2">
          <button
            onClick={refreshFromServer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-black/60 text-white hover:bg-black disabled:opacity-60"
            disabled={isRefreshing}
            title="Re-fetch from server (router.refresh)"
          >
            <RefreshCw className={`${isRefreshing ? "animate-spin" : ""} h-4 w-4`} />
            Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50 shadow-[0_0_0_1px_rgba(16,185,129,0.3)_inset]"
          >
            <Plus className="h-4 w-4" /> New match
          </button>
          <button
            onClick={() => setHiContrast((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-950 text-white hover:bg-zinc-900"
            title="Toggle high contrast rows"
          >
            {hiContrast ? "Normal contrast" : "High contrast"}
          </button>
          <button
            onClick={testRlsCondition}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-blue-400/40 bg-blue-700/30 text-white hover:bg-blue-700/50"
          >
            Test RLS
          </button>
        </div>
      </header>

      {/* Search + filters + sort */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/40 p-3 ring-1 ring-white/5">
        <label className="text-sm text-white/70">Search</label>
        <input
          type="text"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          placeholder="Search team name…"
        className="px-3 py-1.5 rounded-md bg-zinc-950 text-white ring-1 ring-white/10 min-w-[220px] placeholder:text-white/40 focus:outline-none focus:ring-emerald-400/40"
        />

        <div className="h-5 w-px bg-white/10 mx-1" />
        <label className="text-sm text-white/70">Tournament</label>
        <select
          value={tournamentFilter}
          onChange={(e) => setTournamentFilter(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-zinc-950 text-white ring-1 ring-white/10 focus:outline-none focus:ring-emerald-400/40"
        >
          <option value="all">All tournaments</option>
          {tournamentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>

        <div className="h-5 w-px bg-white/10 mx-1" />
        <span className="text-sm text-white/70">Sort</span>
        <div className="inline-flex gap-2">
          <button
            className={btn(sortMode === "oldest")}
            onClick={() => setSortMode("oldest")}
            title="Oldest by match date"
          >
            <Calendar className="h-4 w-4" /> Oldest
          </button>
          <button
            className={btn(sortMode === "newest")}
            onClick={() => setSortMode("newest")}
            title="Newest by match date"
          >
            <Calendar className="h-4 w-4" /> Newest
          </button>
          <button
            className={btn(sortMode === "updated")}
            onClick={() => setSortMode("updated")}
            title="Most recently updated"
          >
            <Clock className="h-4 w-4" /> Last updated
          </button>
        </div>

        {(tournamentFilter !== "all" || teamQuery || sortMode !== "newest") && (
          <button
            onClick={() => {
              setTournamentFilter("all");
              setTeamQuery("");
              setSortMode("newest");
            }}
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/15 bg-zinc-950 text-white hover:bg-zinc-900 text-sm"
            title="Reset filters"
          >
            Reset
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/30 p-3 text-red-200">
          Error: {error}
        </div>
      )}

      {creating && (
        <RowEditor
          initial={{}}
          teams={teams}
          onCancel={() => setCreating(false)}
          onSaved={async () => {
            setCreating(false);
            await refreshFromServer();
          }}
          tournamentName={null}
          stageText={null}
        />
      )}

      {/* Table with sticky header and pagination */}
      {rows.length === 0 ? (
        <p className="text-white/70">No matches yet.</p>
      ) : (
        <div className="border border-white/10 rounded-2xl overflow-hidden shadow-xl shadow-black/40">
          <div className="bg-gradient-to-r from-zinc-950 to-black">
            <Pagination />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-[15px] md:text-base leading-6 text-left text-white/90">
              <thead className="bg-zinc-950/90 text-white sticky top-0 z-10 backdrop-blur supports-backdrop-blur:bg-zinc-950/70">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Match</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="[&>tr]:border-t [&>tr]:border-white/8">
                {pagedRows.map((r, i) => {
                  const a = one<TeamLite>(r.teamA);
                  const b = one<TeamLite>(r.teamB);
                  const tourName =
                    one(r.tournament)?.name ??
                    (r.tournament_id ? `Tournament #${r.tournament_id}` : "—");
                  const stageTxt = stageLabel(r);

                  return (
                    <React.Fragment key={r.id}>
                      <tr className={rowClass(i, r.status)} tabIndex={0}>
                        <td className="px-4 py-3 align-middle whitespace-nowrap">
                          {r.match_date ? isoToDTString(r.match_date) : "—"}
                        </td>
                        <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-3">
                          {a?.logo && (
                            <img
                              src={a.logo}
                              alt={a.name}
                              className="h-8 w-8 rounded-full object-contain ring-1 ring-white/10"
                            />
                          )}
                          <span className="font-semibold text-[16px] md:text-[17px] text-white">
                            {a?.name ?? r.team_a_id}
                          </span>
                          <span className="text-white/60 text-sm">#{a?.id ?? r.team_a_id}</span>

                          <span className="text-white/50 text-base mx-1.5">vs</span>

                          {b?.logo && (
                            <img
                              src={b.logo}
                              alt={b.name}
                              className="h-8 w-8 rounded-full object-contain ring-1 ring-white/10"
                            />
                          )}
                          <span className="font-semibold text-[16px] md:text-[17px] text-white">
                            {b?.name ?? r.team_b_id}
                          </span>
                          <span className="text-white/60 text-sm">#{b?.id ?? r.team_b_id}</span>
                        </div>

                          <div className="mt-1 text-xs text-white/80 flex gap-2">
                            <span
                              className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 ring-1 ring-white/15"
                              title={`tournament_id=${r.tournament_id ?? "—"}`}
                            >
                              {tourName}
                            </span>
                            <span
                              className="px-1.5 py-0.5 rounded bg-white/10 text-white/90 ring-1 ring-white/15"
                              title={`stage_id=${r.stage_id ?? "—"} group_id=${r.group_id ?? "—"}`}
                            >
                              {stageTxt ?? "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2 align-top">
                          <span
                            className={`px-2 py-1 rounded-full border text-xs capitalize ${
                              r.status === "finished"
                                ? "border-emerald-400/30 bg-emerald-600/20 text-emerald-200"
                                : "border-white/10 bg-zinc-800/60 text-white"
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 align-top">
                          {r.team_a_score} – {r.team_b_score}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() =>
                                setEditingId((prev) => (prev === r.id ? null : r.id))
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-950 hover:bg-zinc-900"
                            >
                              <Edit3 className="h-4 w-4" />{" "}
                              {editingId === r.id ? "Close" : "Edit"}
                            </button>
                            <button
                              onClick={() => remove(r.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                            >
                              <Trash2 className="h-4 w-4" /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingId === r.id && (
                        <tr className="bg-black/60">
                          <td className="px-3 py-2 align-top" colSpan={5}>
                            <RowEditor
                              initial={r}
                              teams={teams}
                              onCancel={() => setEditingId(null)}
                              onSaved={async () => {
                                setEditingId(null);
                                await refreshFromServer();
                              }}
                              tournamentName={tourName}
                              stageText={stageTxt}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination />
        </div>
      )}
    </section>
  );
}
