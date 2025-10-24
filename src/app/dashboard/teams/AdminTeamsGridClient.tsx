// app/dashboard/teams/AdminTeamsGridClient.tsx
// CLIENT: grid καρτών ομάδων + dropdown με PlayersPanel. Χωρίς PlayerBoard.
// Το onOpenPlayer → πλοήγηση στη σελίδα παίκτη (π.χ. /dashboard/players/:id)

"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useRouter } from "next/navigation";

import Logo from "./Logo";
import PlayersPanel from "./PlayersPanel";
import TeamRowEditor from "./TeamRowEditor";
import { safeJson, signIfNeeded } from "./teamHelpers";

import type { TeamRow, PlayerAssociation } from "@/app/lib/types";

type TeamRowWithArchived = TeamRow & { deleted_at?: string | null };

function useTeams(initial: TeamRowWithArchived[] | undefined, includeAll: boolean) {
  const [rows, setRows] = useState<TeamRowWithArchived[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL(
        "/api/teams",
        typeof window !== "undefined" ? window.location.origin : "http://localhost"
      );
      url.searchParams.set("sign", "1");
      if (includeAll) url.searchParams.set("include", "all");
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

  useEffect(() => {
    if (!initial) void load();
  }, [includeAll, initial, load]);

  return { rows, setRows, loading, error, load };
}

export default function AdminTeamsGridClient({
  initialRows,
}: {
  initialRows?: TeamRowWithArchived[];
}) {
  const router = useRouter();

  const [showArchived, setShowArchived] = useState(false);
  const { rows, setRows, loading, error, load } = useTeams(initialRows, showArchived);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [q, setQ] = useState("");

  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [playersByTeam, setPlayersByTeam] = useState<Record<number, PlayerAssociation[] | undefined>>({});
  const [playersLoading, setPlayersLoading] = useState<Record<number, boolean>>({});
  const [playersErr, setPlayersErr] = useState<Record<number, string | null>>({});

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => {
      const am = (r as any).am ? String((r as any).am).toLowerCase() : "";
      return r.name.toLowerCase().includes(term) || am.includes(term);
    });
  }, [rows, q]);

  async function remove(id: number) {
    if (
      !confirm(
        "Να αρχειοθετηθεί η ομάδα; Θα κρυφτεί από νέα παιχνίδια, αλλά το ιστορικό θα παραμείνει."
      )
    )
      return;
    try {
      const res = await fetch(`/api/teams/${id}`, { method: "DELETE", credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const updated = body?.team as TeamRowWithArchived | undefined;
      if (updated) {
        const logo = await signIfNeeded(updated.logo);
        const updatedSigned = { ...updated, logo };
        setRows((prev) => prev.map((r) => (r.id === id ? updatedSigned : r)));
      } else {
        setRows((prev) =>
          prev.map((r) => (r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r))
        );
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

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

  const handleOpenPlayer = (playerId: number) => {
    router.push(`/dashboard/players/${playerId}`);
  };

  return (
    <section className="space-y-4">
      {/* Εργαλειοθήκη */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-bold text-white">Ομάδες</h2>
        <div className="flex flex-1 gap-2 sm:flex-none">
          <input
            placeholder="Αναζήτηση με όνομα ή ΑΜ…"
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
            Εμφάνιση αρχειοθετημένων
          </label>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white hover:bg-zinc-800"
          >
            <RefreshCw className="h-4 w-4" /> Ανανέωση
          </button>
          <button
            onClick={() => {
              setCreating(true);
              setEditingId(null);
            }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50"
          >
            <Plus className="h-4 w-4" /> Νέα ομάδα
          </button>
        </div>
      </header>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/30 p-3 text-red-200">
          Σφάλμα: {error}
        </div>
      )}

      {/* Δημιουργία νέας ομάδας */}
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

      {/* GRID Καρτών Ομάδων */}
      {loading ? (
        <p className="p-3 text-white/70">Φόρτωση…</p>
      ) : filtered.length === 0 ? (
        <p className="p-3 text-white/70">Δεν βρέθηκαν ομάδες.</p>
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
                {/* Κεφαλίδα κάρτας (χωρίς κουμπιά ενεργειών) */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => togglePlayers(r.id)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
                      title={isExpanded ? "Απόκρυψη λεπτομερειών" : "Εμφάνιση λεπτομερειών"}
                    >
                      {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    </button>
                    <Logo src={r.logo} alt={r.name} />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-2">
                        <span className={archived ? "line-through decoration-white/40" : ""}>{r.name}</span>
                        {archived && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                            Αρχειοθετημένη
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-white/50">
                        ID #{r.id}
                        {r.created_at ? ` • ${new Date(r.created_at).toLocaleString("el-GR")}` : " • —"}
                        {(r as any).am ? ` • ΑΜ: ${(r as any).am}` : ""}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Πτώση λεπτομερειών: Controls bar + (optional) Inline editor + PlayersPanel */}
                <div
                  className={`mt-3 overflow-hidden transition-[max-height,opacity,transform] duration-300 ${
                    isExpanded ? "opacity-100 max-h-[1000px] translate-y-0" : "opacity-0 max-h-0 -translate-y-1"
                  }`}
                >
                  {/* Controls bar */}
                  <div className="rounded-xl border border-white/10 bg-zinc-950/80 p-3 mb-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-white/60">
                        Ενέργειες για: <span className="text-white font-medium">{r.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {!archived ? (
                          <>
                            {editingId !== r.id && (
                              <button
                                onClick={() => {
                                  setCreating(false);
                                  setEditingId(r.id);
                                }}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                              >
                                <Edit3 className="h-4 w-4" /> Επεξεργασία
                              </button>
                            )}
                            <button
                              onClick={() => remove(r.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                            >
                              <Trash2 className="h-4 w-4" /> Αρχειοθέτηση
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => restore(r.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                            title="Επαναφορά ομάδας"
                          >
                            <RotateCcw className="h-4 w-4" /> Επαναφορά
                          </button>
                        )}

                        <button
                          onClick={load}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                          title="Ανανέωση"
                        >
                          <RefreshCw className="h-4 w-4" /> Ανανέωση
                        </button>
                      </div>
                    </div>

                    {/* Inline editor inside dropdown */}
                    {editingId === r.id && (
                      <div className="mt-3">
                        <TeamRowEditor
                          initial={r}
                          onCancel={() => setEditingId(null)}
                          onSaved={async (updated) => {
                            setEditingId(null);
                            const logo = await signIfNeeded(updated.logo);
                            const updatedSigned = { ...(updated as TeamRowWithArchived), logo };
                            setRows((prev) =>
                              prev.map((x) => (x.id === updatedSigned.id ? updatedSigned : x))
                            );
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* PlayersPanel */}
                  <div className="rounded-xl border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-4 flex-1 overflow-y-auto">
                  <h3 className="text-sm font-semibold text-white/90 mb-3">Παίκτες ομάδας</h3>
                  <PlayersPanel
                    teamId={r.id}
                    associations={assoc}
                    isLoading={isLoading}
                    error={err || null}
                    onOpenPlayer={(playerId: number) => handleOpenPlayer(playerId)}
                  />
                </div>

                  {archived && r.deleted_at ? (
                    <p className="mt-2 text-xs text-white/50">
                      Αρχειοθετήθηκε στις {new Date(r.deleted_at).toLocaleDateString("el-GR")}.
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
