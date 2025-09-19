// components/DashboardPageComponents/AdminTeamsCRUD.tsx
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, RefreshCw, Trash2, ChevronRight, ChevronDown, RotateCcw } from "lucide-react";
import PlayerBoard from "./players/PlayerBoard";
import Logo from "./teams/Logo";
import PlayersPanel from "./teams/PlayersPanel";
import TeamRowEditor from "./teams/TeamRowEditor";
import { safeJson, signIfNeeded } from "./teams/teamHelpers";
import type {
  TeamRow,
  PlayerRow as Player,
  PlayerAssociation, // ✅ use normalized association type
} from "@/app/lib/types";

// Local type that tolerates projects where TeamRow hasn't been updated yet.
type TeamRowWithArchived = TeamRow & { deleted_at?: string | null };

// ------------------------------------------------------------------
// Data hook (accepts optional server-provided initial rows and includeAll flag)
// ------------------------------------------------------------------
function useTeams(initial: TeamRowWithArchived[] | undefined, includeAll: boolean) {
  const [rows, setRows] = useState<TeamRowWithArchived[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/teams", typeof window !== "undefined" ? window.location.origin : "http://localhost");
      url.searchParams.set("sign", "1");
      if (includeAll) url.searchParams.set("include", "all"); // active + archived
      const res = await fetch(url.toString(), { credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const list = (body?.teams as TeamRowWithArchived[]) ?? [];
      setRows(list);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }, [includeAll]);

  useEffect(() => {
    if (!initial) void load();
  }, [initial, load]);

  // 🔁 Ensure toggling "Show archived" always refetches
  useEffect(() => {
    if (!initial) void load();
  }, [includeAll, initial, load]);

  return { rows, setRows, loading, error, load };
}

// ------------------------------------------------------------------
// Main component
// ------------------------------------------------------------------
export default function AdminTeamsCRUD({ initialRows }: { initialRows?: TeamRowWithArchived[] }) {
  const [showArchived, setShowArchived] = useState(false);
  const { rows, setRows, loading, error, load } = useTeams(initialRows, showArchived);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // Expand state + per-team players cache/loading/error
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [playersByTeam, setPlayersByTeam] = useState<Record<number, PlayerAssociation[] | undefined>>({});
  const [playersLoading, setPlayersLoading] = useState<Record<number, boolean>>({});
  const [playersErr, setPlayersErr] = useState<Record<number, string | null>>({});

  // Player drawer state
  const [drawer, setDrawer] = useState<{ open: boolean; teamId: number | null; playerId: number | null }>(
    { open: false, teamId: null, playerId: null }
  );

  const openPlayer = (teamId: number, playerId: number) => setDrawer({ open: true, teamId, playerId });
  const closePlayer = () => setDrawer({ open: false, teamId: null, playerId: null });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term));
  }, [rows, q]);

  // Soft delete → archive (sets deleted_at)
  async function remove(id: number) {
    if (!confirm("Archive this team? It will be hidden from new matches, but history stays.")) return;
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE", credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // Prefer server echo (route returns { team } with deleted_at)
      const updated = (body?.team as TeamRowWithArchived | undefined);
      if (updated) {
        const logo = await signIfNeeded(updated.logo);
        const updatedSigned = { ...updated, logo };
        setRows((prev) => prev.map((r) => (r.id === id ? updatedSigned : r)));
      } else {
        // Fallback: mark locally
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r)));
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  // Restore archived team
  async function restore(id: number) {
    try {
      // Try dedicated /restore endpoint first
      let res = await fetch(`/api/teams/${id}/restore`, { method: "POST", credentials: "include" });

      // Fallback to legacy POST /api/teams/:id if /restore isn't present in this project
      if (res.status === 404) {
        res = await fetch(`/api/teams/${id}`, { method: "POST", credentials: "include" });
      }

      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const restored = (body?.team as TeamRowWithArchived | undefined) ?? null;
      if (restored) {
        const logo = await signIfNeeded(restored.logo);
        const restoredSigned = { ...restored, logo };
        setRows((prev) => prev.map((r) => (r.id === id ? restoredSigned : r)));
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deleted_at: null } : r)));
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  // Toggle expand + lazy-load players
  async function togglePlayers(id: number) {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
    if (!expanded[id] && playersByTeam[id] === undefined) {
      setPlayersLoading((s) => ({ ...s, [id]: true }));
      setPlayersErr((s) => ({ ...s, [id]: null }));
      try {
        const res = await fetch(`/api/teams/${id}/players`, { credentials: "include" });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        // body.playerAssociations is already normalized server-side
        setPlayersByTeam((m) => ({ ...m, [id]: (body?.playerAssociations as PlayerAssociation[]) ?? [] }));
      } catch (e: any) {
        setPlayersErr((s) => ({ ...s, [id]: e?.message ?? String(e) }));
      } finally {
        setPlayersLoading((s) => ({ ...s, [id]: false }));
      }
    }
  }

  return (
    <section className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-white">Teams</h2>
        <div className="flex flex-1 gap-2 sm:flex-none">
          <input
            placeholder="Search by name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="flex-1 sm:flex-none sm:w-64 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/15"
          />
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50"
          >
            <Plus className="h-4 w-4" /> New team
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/30 p-3 text-red-200">
          Error: {error}
        </div>
      )}

      {creating && (
        <TeamRowEditor
          key="create"
          onCancel={() => setCreating(false)}
          onSaved={async (created) => {
            const logo = await signIfNeeded(created.logo);
            const createdSigned = { ...(created as TeamRowWithArchived), logo };
            setCreating(false);
            setRows((prev) => [createdSigned, ...prev]);
          }}
        />
      )}

      <div className="overflow-x-auto border border-white/10 rounded-xl">
        {loading ? (
          <p className="p-3 text-white/70">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-white/70">No teams found.</p>
        ) : (
          <table className="min-w-full text-sm text-left text-white/90">
            <thead className="bg-zinc-900/70 text-white">
              <tr>
                <th className="px-3 py-2">Team</th>
                <th className="px-3 py-2">Created</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const archived = !!(r as TeamRowWithArchived).deleted_at;
                const isExpanded = !!expanded[r.id];
                const assoc = playersByTeam[r.id];
                const isLoading = !!playersLoading[r.id];
                const err = playersErr[r.id];

                return (
                  <React.Fragment key={r.id}>
                    <tr
                      className={
                        archived
                          ? "align-top bg-zinc-900/30 opacity-70"
                          : "align-top odd:bg-zinc-950/60 even:bg-zinc-900/40"
                      }
                    >
                      <td className="px-3 py-2">
                        {editingId === r.id ? (
                          <TeamRowEditor
                            initial={r}
                            onCancel={() => setEditingId(null)}
                            onSaved={async (updated) => {
                              setEditingId(null);
                              const logo = await signIfNeeded(updated.logo);
                              const updatedSigned = { ...(updated as TeamRowWithArchived), logo };
                              setRows((prev) => prev.map((x) => (x.id === updatedSigned.id ? updatedSigned : x)));
                            }}
                          />
                        ) : (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => togglePlayers(r.id)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
                              title={isExpanded ? "Hide players" : "Show players"}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                            <Logo src={r.logo} alt={r.name} />
                            <div>
                              <div className="font-semibold flex items-center gap-2">
                                <span className={archived ? "line-through decoration-white/40" : ""}>{r.name}</span>
                                {archived && (
                                  <span className="text-xs px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                                    Archived
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/50">
                                ID #{r.id}
                                {archived && (r as TeamRowWithArchived).deleted_at && (
                                  <span className="ml-2">
                                    • deleted {new Date((r as TeamRowWithArchived).deleted_at!).toLocaleDateString()}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {editingId !== r.id && (
                          <div className="flex items-center gap-2 justify-end">
                            {!archived ? (
                              <>
                                <button
                                  onClick={() => {
                                    setCreating(false);
                                    setEditingId(r.id);
                                  }}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                                >
                                  <Edit3 className="h-4 w-4" /> Edit
                                </button>
                                <button
                                  onClick={() => remove(r.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                                >
                                  <Trash2 className="h-4 w-4" /> Archive
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => restore(r.id)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                                title="Restore team"
                              >
                                <RotateCcw className="h-4 w-4" /> Restore
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-black/30">
                        <td className="px-3 pt-0 pb-4" colSpan={3}>
                          <PlayersPanel
                            teamId={r.id}
                            associations={assoc}
                            isLoading={isLoading}
                            error={err}
                            onOpenPlayer={(playerId: number) => openPlayer(r.id, playerId)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Player edit drawer */}
      <PlayerBoard
        open={drawer.open}
        playerId={drawer.playerId}
        onClose={closePlayer}
        onSaved={(updated: Player) => {
          if (!drawer.teamId) return;
          const tId = drawer.teamId;
          setPlayersByTeam((prev) => {
            const current = prev[tId] ?? [];
            const list = current.map((pa) =>
              pa.player.id === updated.id ? { ...pa, player: { ...pa.player, ...updated } } : pa
            );
            return { ...prev, [tId]: list };
          });
        }}
      />
    </section>
  );
}
