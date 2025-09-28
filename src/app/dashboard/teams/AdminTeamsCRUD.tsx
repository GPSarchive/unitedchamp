
// =====================================================================
// Client component (same file). We purposely split it with a re-export.
// =====================================================================
"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Edit3, Plus, RefreshCw, Trash2, ChevronRight, ChevronDown, RotateCcw } from "lucide-react";
import PlayerBoard from "../players/PlayerBoard";
import Logo from "./Logo";
import PlayersPanel from "./PlayersPanel";
import TeamRowEditor from "./TeamRowEditor";
import { safeJson, signIfNeeded } from "./teamHelpers";
import type {
  TeamRow,
  PlayerRow as Player,
  PlayerAssociation, // ✅ use normalized association type
} from "@/app/lib/types";

// Local tolerant type
type TeamRowWithArchived = TeamRow & { deleted_at?: string | null };

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

  // ensure toggling "Show archived" refetches
  useEffect(() => {
    if (!initial) void load();
  }, [includeAll, initial, load]);

  return { rows, setRows, loading, error, load };
}

export function AdminTeamsGridClient({
  initialRows,
}: {
  initialRows?: TeamRowWithArchived[];
}) {
  const [showArchived, setShowArchived] = useState(false);
  const { rows, setRows, loading, error, load } = useTeams(initialRows, showArchived);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // expand/cache state per team
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [playersByTeam, setPlayersByTeam] = useState<Record<number, PlayerAssociation[] | undefined>>({});
  const [playersLoading, setPlayersLoading] = useState<Record<number, boolean>>({});
  const [playersErr, setPlayersErr] = useState<Record<number, string | null>>({});

  // player drawer state
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

  // soft delete → archive
  async function remove(id: number) {
    if (!confirm("Archive this team? It will be hidden from new matches, but history stays.")) return;
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE", credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const updated = (body?.team as TeamRowWithArchived | undefined);
      if (updated) {
        const logo = await signIfNeeded(updated.logo);
        const updatedSigned = { ...updated, logo };
        setRows((prev) => prev.map((r) => (r.id === id ? updatedSigned : r)));
      } else {
        setRows((prev) => prev.map((r) => (r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r)));
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  // restore archived
  async function restore(id: number) {
    try {
      let res = await fetch(`/api/teams/${id}/restore`, { method: "POST", credentials: "include" });
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

  // toggle dropdown + lazy load players
  async function togglePlayers(id: number) {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
    if (!expanded[id] && playersByTeam[id] === undefined) {
      setPlayersLoading((s) => ({ ...s, [id]: true }));
      setPlayersErr((s) => ({ ...s, [id]: null }));
      try {
        const res = await fetch(`/api/teams/${id}/players`, { credentials: "include" });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
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
      {/* Toolbar */}
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

      {/* Inline create editor */}
      {creating && (
        <div className="border border-white/10 rounded-2xl p-3 bg-black/40">
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
        </div>
      )}

      {/* GRID of team cards */}
      {loading ? (
        <p className="p-3 text-white/70">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="p-3 text-white/70">No teams found.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((r) => {
            const archived = !!(r as TeamRowWithArchived).deleted_at;
            const isExpanded = !!expanded[r.id];
            const assoc = playersByTeam[r.id];
            const isLoading = !!playersLoading[r.id];
            const err = playersErr[r.id];

            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-3 shadow-sm transition ${
                  archived
                    ? "opacity-70 border-amber-400/20 bg-zinc-900/40"
                    : "border-white/10 bg-zinc-950/60 hover:bg-zinc-950/80"
                }`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => togglePlayers(r.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
                      title={isExpanded ? "Hide details" : "Show details"}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Logo src={r.logo} alt={r.name} />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-2">
                        <span className={archived ? "line-through decoration-white/40" : ""}>{r.name}</span>
                        {archived && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                            Archived
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50">
                        ID #{r.id} • {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {editingId !== r.id ? (
                    <div className="flex items-center gap-2">
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
                  ) : null}
                </div>

                {/* Inline editor mode replaces the header area */}
                {editingId === r.id && (
                  <div className="mt-3">
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
                  </div>
                )}

                {/* Dropdown details (players, etc.) */}
                <div
                  className={`mt-3 overflow-hidden transition-[max-height,opacity,transform] duration-300 ${
                    isExpanded ? "opacity-100 max-h-[1000px] translate-y-0" : "opacity-0 max-h-0 -translate-y-1"
                  }`}
                >
                  <div className="rounded-xl border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-4">
                    <h3 className="text-sm font-semibold text-white/90 mb-3">Current Players</h3>
                    <PlayersPanel
                      teamId={r.id}
                      associations={assoc}
                      isLoading={isLoading}
                      error={err || null}
                      onOpenPlayer={(playerId: number) => openPlayer(r.id, playerId)}
                    />
                  </div>
                  {archived && r.deleted_at ? (
                    <p className="mt-2 text-xs text-white/50">
                      Archived on {new Date(r.deleted_at).toLocaleDateString()}.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Player edit drawer (shared across cards) */}
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

// Re-export default name used above to keep file-local typing happy
export { AdminTeamsGridClient as default };
