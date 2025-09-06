"use client";

import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabaseClient";
import { Edit3, Plus, Trash2, RefreshCw } from "lucide-react";
import RowEditor from "./RowEditor";
import type { Id, TeamLite, MatchRow as BaseMatchRow, MaybeArray } from "@/app/lib/types";

// Extend the shared MatchRow with aliased team joins used by this UI
export type MatchRow = BaseMatchRow & {
  teamA?: MaybeArray<TeamLite>;
  teamB?: MaybeArray<TeamLite>;
};

type MatchesDashboardProps = {
  initialTeams?: TeamLite[];
  initialMatches?: MatchRow[];
};

const STATUSES: BaseMatchRow["status"][] = ["scheduled", "live", "finished", "canceled"];

// ===== Small datetime helpers =====
function isoToDTString(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const m = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const hh = pad(d.getUTCHours());
  const mm = pad(d.getUTCMinutes());
  return `${y}-${m}-${day}T${hh}:${mm}`;
}

function dtStringToIso(value: string | null): string | null {
  if (!value) return null;
  const parts = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!parts) return null;
  const [, yStr, mStr, dStr, hhStr, mmStr] = parts;
  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);
  const hh = Number(hhStr);
  const mm = Number(mmStr);
  const utcDate = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  return utcDate.toISOString();
}

function one<T>(v: MaybeArray<T> | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : (v ?? null);
}

// ===== New: small label helper to include team id =====
function teamLabel(t: TeamLite | null, fallbackId?: Id) {
  return t ? `${t.name} (#${t.id})` : `#${fallbackId ?? ""}`;
}

// RowEditor moved to ./RowEditor

// ===== Main Dashboard component =====
export default function MatchesDashboard({
  initialTeams = [],
  initialMatches = [],
}: MatchesDashboardProps) {
  // hydrate from server props
  const [teams, setTeams] = useState<TeamLite[]>(initialTeams);
  const [rows, setRows] = useState<MatchRow[]>(initialMatches);
  const [loading, setLoading] = useState(teams.length === 0 && rows.length === 0);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id | null>(null);

  // Helpful counts
  useEffect(() => {
    console.info("[MatchesDashboard] counts", {
      initialTeams: initialTeams.length,
      initialMatches: initialMatches.length,
      rows: rows.length,
      loading,
    });
  }, [initialTeams.length, initialMatches.length, rows.length, loading]);

  const editingRow = useMemo(() => rows.find((r) => r.id === editingId), [rows, editingId]);

  // Warn when editing row not found
  useEffect(() => {
    if (editingId && !editingRow) {
      console.warn(
        `[MatchesDashboard] editingId=${editingId} but row not found in rows[] (maybe reloaded/deleted).`
      );
    }
  }, [editingId, editingRow]);

  async function load() {
    console.groupCollapsed("[MatchesDashboard] load");
    setLoading(true);
    setError(null);

    try {
      // Who am I? (RLS often depends on the authenticated user)
      const { data: userData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        console.warn("[MatchesDashboard] auth.getUser error", authErr);
      } else {
        console.log("[MatchesDashboard] auth user id", userData?.user?.id ?? null);
        console.log("User app_metadata:", userData?.user?.app_metadata);
      }

      // --- TEAMS ---
      console.time("[MatchesDashboard] fetch teams");
      const { data: teamData, error: teamErr } = await supabase
        .from("teams")
        .select("id, name, logo")
        .order("name", { ascending: true });
      console.timeEnd("[MatchesDashboard] fetch teams");
      console.log("[MatchesDashboard] teams response", { count: teamData?.length ?? 0, teamErr });
      if (teamErr) throw teamErr;
      if (Array.isArray(teamData) && teamData.length > 0) setTeams(teamData as TeamLite[]);

      // --- MATCHES (column-based join like OMADA pages) ---
      console.time("[MatchesDashboard] fetch matches");
      const { data: matchData, error: matchErr } = await supabase
        .from("matches")
        .select(
          `
          id, match_date, status, team_a_id, team_b_id, team_a_score, team_b_score, winner_team_id,
          team_a:team_a_id (id, name, logo),
          team_b:team_b_id (id, name, logo)
        `
        )
        .order("match_date", { ascending: true });
      console.timeEnd("[MatchesDashboard] fetch matches");
      console.log("[MatchesDashboard] matches response", { count: matchData?.length ?? 0, matchErr });
      if (matchErr) throw matchErr;

      if (Array.isArray(matchData) && matchData.length > 0) {
        const normalized = (matchData as any[]).map((m: any) => ({
          ...m,
          teamA: m.teamA ?? m.team_a ?? null,
          teamB: m.teamB ?? m.team_b ?? null,
        }));
        console.table(normalized);
        setRows(normalized as MatchRow[]);
      } else {
        console.warn(
          "[MatchesDashboard] client fetch returned 0 rows; keeping existing rows (likely RLS)."
        );
      }
    } catch (e: any) {
      console.error("[MatchesDashboard] load error", e);
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
      console.groupEnd();
    }
  }

  // ❗ Only fetch on mount if server didn't send data (avoid overwriting SSR rows)
  useEffect(() => {
    const shouldFetch = initialTeams.length === 0 || initialMatches.length === 0;
    if (shouldFetch) void load();
  }, [initialTeams.length, initialMatches.length]);

  async function remove(id: Id) {
    if (!confirm("Delete this match? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? `HTTP ${res.status}`);
      }
      setRows((r) => r.filter((x) => x.id !== id));
    } catch (e: any) {
      alert(e.message ?? String(e));
    }
  }

  async function testRlsCondition() {
    const { data, error } = await supabase.rpc("test_admin_role");
    if (error) console.error("RLS Test Error:", error);
    console.log("Is admin role present?:", data);
  }

  return (
    <section className="space-y-6">
      <header className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Matches</h2>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
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
          onSaved={() => {
            setCreating(false);
            load();
          }}
        />
      )}

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : rows.length === 0 ? (
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
              {rows.map((r) => {
                const a = one<TeamLite>(r.teamA);
                const b = one<TeamLite>(r.teamB);
                return (
                  <tr key={r.id} className="odd:bg-zinc-950/60 even:bg-zinc-900/40">
                    <td className="px-3 py-2 align-top whitespace-nowrap">
                      {r.match_date ? isoToDTString(r.match_date).replace("T", " ") : "—"}
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
                      {editingId === r.id ? (
                        <RowEditor
                          initial={r}
                          teams={teams}
                          onCancel={() => setEditingId(null)}
                          onSaved={() => {
                            setEditingId(null);
                            load();
                          }}
                        />
                      ) : (
                        <div className="flex items-center gap-2 justify-end">
                          <button
                            onClick={() => setEditingId(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                          >
                            <Edit3 className="h-4 w-4" /> Edit
                          </button>
                          <button
                            onClick={() => remove(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                          >
                            <Trash2 className="h-4 w-4" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
