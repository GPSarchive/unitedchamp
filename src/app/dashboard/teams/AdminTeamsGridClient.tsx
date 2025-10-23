"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Plus,
  RefreshCw,
  Trash2,
  RotateCcw,
} from "lucide-react";

import Logo from "./Logo";
import TeamRowEditor from "./TeamRowEditor";
import { safeJson, signIfNeeded } from "./teamHelpers";
import TeamDetailsPanel from "./TeamDetailsPanel"; // Import the new TeamDetailsPanel component

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

  // Panel open state for editing teams and managing players
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);

  const handleEditTeam = (teamId: number) => {
    setSelectedTeamId(teamId);
    setPanelOpen(true);
  };

  const handleClosePanel = () => {
    setPanelOpen(false);
    setSelectedTeamId(null);
  };

  const handleSaveTeam = (savedTeam: any) => {
    setRows((prev) => prev.map((x) => (x.id === savedTeam.id ? savedTeam : x)));
    setPanelOpen(false);
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
              setSelectedTeamId(null);
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

            return (
              <div
                key={r.id}
                className={`rounded-2xl border p-3 shadow-sm transition ${
                  archived
                    ? "opacity-70 border-amber-400/20 bg-zinc-900/40"
                    : "border-white/10 bg-zinc-950/60 hover:bg-zinc-950/80"
                }`}
              >
                {/* Κεφαλίδα κάρτας */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Logo src={r.logo} alt={r.name} />
                    <div className="min-w-0">
                      <div className="font-semibold text-white truncate flex items-center gap-2">
                        <span className={archived ? "line-through decoration-white/40" : ""}>
                          {r.name}
                        </span>
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

                {/* Controls and Actions */}
                <div className="mt-3 flex justify-between gap-2">
                  {!archived ? (
                    <>
                      <button
                        onClick={() => handleEditTeam(r.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                      >
                        <Edit3 className="h-4 w-4" /> Επεξεργασία
                      </button>
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
            );
          })}
        </div>
      )}

      {/* Team Details Panel */}
      {selectedTeamId && (
        <TeamDetailsPanel
          teamId={selectedTeamId}
          open={panelOpen}
          onClose={handleClosePanel}
          onSaved={handleSaveTeam}
        />
      )}
    </section>
  );
}
