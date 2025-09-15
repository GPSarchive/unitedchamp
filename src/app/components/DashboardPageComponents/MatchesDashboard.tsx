"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Edit3, Plus, Trash2, RefreshCw, Calendar, Clock } from "lucide-react";
// (Optional) keep supabase only for your "Test RLS" button; not used for data loading
import { supabase } from "@/app/lib/supabaseClient";

import RowEditor from "./RowEditor";
import type { Id, TeamLite, MatchRow as BaseMatchRow, MaybeArray } from "@/app/lib/types";

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
  return Array.isArray(v) ? v[0] ?? null : v ?? null;
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

  // Keep local state in sync when the server re-hydrates with new data
  useEffect(() => setTeams(initialTeams), [initialTeams]);
  useEffect(() => setRows(initialMatches), [initialMatches]);

  // Initialize tournament filter from parent (?tid=...)
  useEffect(() => {
    if (defaultTournamentId != null) {
      setTournamentFilter(String(defaultTournamentId));
    }
  }, [defaultTournamentId]);

  const editingRow = useMemo(() => rows.find((r) => r.id === editingId), [rows, editingId]);

  async function refreshFromServer() {
    setIsRefreshing(true);
    setError(null);
    try {
      // This tells Next to re-render the parent server page, which will refetch
      router.refresh();
    } finally {
      // After a refresh, this component will typically re-render with fresh props
      // (and may even remount), so this flag is mostly for UX spinners.
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }

  async function remove(id: Id) {
    if (!confirm("Delete this match? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = data?.error ?? `HTTP ${res.status}`;
        const dbg =
          data?.__debug?.message ||
          data?.__debug?.details ||
          data?.__debug?.hint ||
          "";
        throw new Error(dbg ? `${base} — ${dbg}` : base);
      }

      // Optimistic update for snappy UX
      setRows((r) => r.filter((x) => x.id !== id));
      // Ask server to refresh the canonical list
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

  const btn = (active: boolean) =>
    `inline-flex items-center gap-1 px-2 py-1 rounded-md border text-sm ${
      active
        ? "border-emerald-400/40 bg-emerald-700/30 text-white"
        : "border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
    }`;

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Matches</h2>
        <div className="flex gap-2">
          <button
            onClick={refreshFromServer}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800 disabled:opacity-60"
            disabled={isRefreshing}
            title="Re-fetch from server (router.refresh)"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50"
          >
            <Plus className="h-4 w-4" /> New match
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/10 bg-black/20 p-3">
        <label className="text-sm text-white/70">Search</label>
        <input
          type="text"
          value={teamQuery}
          onChange={(e) => setTeamQuery(e.target.value)}
          placeholder="Search team name…"
          className="px-3 py-1.5 rounded-md bg-zinc-900 text-white ring-1 ring-white/10 min-w-[220px]"
        />

        <div className="h-5 w-px bg-white/10 mx-1" />
        <label className="text-sm text-white/70">Tournament</label>
        <select
          value={tournamentFilter}
          onChange={(e) => setTournamentFilter(e.target.value)}
          className="px-2 py-1.5 rounded-md bg-zinc-900 text-white ring-1 ring-white/10"
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
            className="ml-auto inline-flex items-center gap-1 px-2 py-1 rounded-md border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800 text-sm"
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

      {rows.length === 0 ? (
        <p className="text-white/70">No matches yet.</p>
      ) : (
        <div className="overflow-x-auto border border-white/10 rounded-xl">
          <table className="min-w-full text-sm text-left text-white/90">
            <thead className="bg-zinc-900/70 text-white">
              <tr>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Match</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Score</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayRows.map((r) => {
                const a = one<TeamLite>(r.teamA);
                const b = one<TeamLite>(r.teamB);
                const tourName =
                  one(r.tournament)?.name ??
                  (r.tournament_id ? `Tournament #${r.tournament_id}` : "—");
                const stageTxt = stageLabel(r);

                return (
                  <React.Fragment key={r.id}>
                    <tr className="odd:bg-zinc-950/60 even:bg-zinc-900/40">
                      <td className="px-3 py-2 align-top whitespace-nowrap">
                        {r.match_date ? isoToDTString(r.match_date) : "—"}
                      </td>
                      <td className="px-3 py-2 align-top">
                        <div className="flex items-center gap-2">
                          {a?.logo && (
                            <img
                              src={a.logo}
                              alt={a.name}
                              className="h-6 w-6 rounded-full object-contain ring-1 ring-white/10"
                              title={teamLabel(a)}
                            />
                          )}
                          <span className="font-semibold">{a?.name ?? r.team_a_id}</span>
                          <span className="text-white/50 text-xs">#{a?.id ?? r.team_a_id}</span>

                          <span className="text-white/50">vs</span>

                          {b?.logo && (
                            <img
                              src={b.logo}
                              alt={b.name}
                              className="h-6 w-6 rounded-full object-contain ring-1 ring-white/10"
                              title={teamLabel(b)}
                            />
                          )}
                          <span className="font-semibold">{b?.name ?? r.team_b_id}</span>
                          <span className="text-white/50 text-xs">#{b?.id ?? r.team_b_id}</span>
                        </div>

                        <div className="mt-1 text-xs text-white/60 flex gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded bg-white/5 ring-1 ring-white/10"
                            title={`tournament_id=${r.tournament_id ?? "—"}`}
                          >
                            {tourName}
                          </span>
                          <span
                            className="px-1.5 py-0.5 rounded bg-white/5 ring-1 ring-white/10"
                            title={`stage_id=${r.stage_id ?? "—"} group_id=${r.group_id ?? "—"}`}
                          >
                            {stageTxt ?? "—"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 align-top">
                        <span className="px-2 py-1 rounded-full border border-white/10 bg-black/30 capitalize">
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
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
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
                      <tr className="bg-black/40">
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
      )}
    </section>
  );
}
