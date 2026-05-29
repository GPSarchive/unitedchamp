// src/app/dashboard/preview/teams-v2/MobileTeamsView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson, signIfNeeded } from "../../teams/teamHelpers";
import type { TeamRow, PlayerAssociation } from "@/app/lib/types";

import MobileTeamsTopBar from "./MobileTeamsTopBar";
import MobileTeamCard, { type TeamCardRow } from "./MobileTeamCard";
import MobileTeamActionSheet from "./MobileTeamActionSheet";
import MobileTeamPlayersSheet from "./MobileTeamPlayersSheet";
import MobileTeamEditorSheet from "./MobileTeamEditorSheet";
import MobileTeamsFilterSheet, { type StatusFilter } from "./MobileTeamsFilterSheet";

type TeamRowWithArchived = TeamRow & { deleted_at?: string | null };

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function toRow(t: TeamRowWithArchived): TeamCardRow {
  return {
    id: t.id,
    name: t.name,
    am: (t as any).am ?? null,
    logo: t.logo ?? null,
    colour: t.colour ?? null,
    season_score: t.season_score ?? null,
    created_at: t.created_at ?? null,
    deleted_at: t.deleted_at ?? null,
    raw: t,
  };
}

export default function MobileTeamsView() {
  const [teams, setTeams] = useState<TeamRowWithArchived[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);
  const [status, setStatus] = useState<StatusFilter>("active");

  // sheets
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionRow, setActionRow] = useState<TeamCardRow | null>(null);
  const [playersFor, setPlayersFor] = useState<TeamCardRow | null>(null);
  const [editorRow, setEditorRow] = useState<TeamRowWithArchived | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  // players cache per team id (kept across opens within session)
  const [playersByTeam, setPlayersByTeam] = useState<
    Record<number, PlayerAssociation[] | undefined>
  >({});
  const [playersLoading, setPlayersLoading] = useState<Record<number, boolean>>({});
  const [playersErr, setPlayersErr] = useState<Record<number, string | null>>({});

  async function fetchTeams(statusVal: StatusFilter) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("sign", "1");
      if (statusVal === "archived") params.set("include", "archived");
      else if (statusVal === "all") params.set("include", "all");

      const res = await fetch(`/api/teams?${params.toString()}`, {
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const list = (body?.teams as TeamRowWithArchived[]) ?? [];
      setTeams(list);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTeams(status);
  }, [status]);

  const allRows = useMemo(() => teams.map(toRow), [teams]);

  const filteredRows = useMemo(() => {
    const term = debouncedQ.trim().toLowerCase();
    if (!term) return allRows;
    return allRows.filter((r) => {
      const am = r.am ? String(r.am).toLowerCase() : "";
      return r.name.toLowerCase().includes(term) || am.includes(term);
    });
  }, [allRows, debouncedQ]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (status !== "active") n++;
    return n;
  }, [status]);

  async function loadPlayers(teamId: number, force = false) {
    if (!force && playersByTeam[teamId] !== undefined) return;
    setPlayersLoading((s) => ({ ...s, [teamId]: true }));
    setPlayersErr((s) => ({ ...s, [teamId]: null }));
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setPlayersByTeam((m) => ({
        ...m,
        [teamId]: (body?.playerAssociations as PlayerAssociation[]) ?? [],
      }));
    } catch (e: any) {
      setPlayersErr((s) => ({ ...s, [teamId]: e?.message ?? String(e) }));
    } finally {
      setPlayersLoading((s) => ({ ...s, [teamId]: false }));
    }
  }

  function openPlayers(row: TeamCardRow) {
    setPlayersFor(row);
    void loadPlayers(row.id);
  }

  function openCreate() {
    setEditorRow(null);
    setEditorOpen(true);
  }

  function openEdit(row: TeamCardRow) {
    setEditorRow(row.raw as TeamRowWithArchived);
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorRow(null);
  }

  async function handleSaved(saved: TeamRow) {
    const logo = await signIfNeeded(saved.logo);
    const signed = { ...(saved as TeamRowWithArchived), logo };
    setTeams((prev) => {
      const exists = prev.some((t) => t.id === signed.id);
      if (exists) return prev.map((t) => (t.id === signed.id ? signed : t));
      return [signed, ...prev];
    });
    closeEditor();
  }

  async function handleArchive(id: number) {
    if (
      !confirm(
        "Αρχειοθέτηση ομάδας; Θα κρυφτεί από νέους αγώνες, αλλά το ιστορικό παραμένει."
      )
    )
      return;
    try {
      const res = await fetch(`/api/teams/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const updated = body?.team as TeamRowWithArchived | undefined;
      if (updated) {
        const logo = await signIfNeeded(updated.logo);
        const signed = { ...updated, logo };
        setTeams((prev) =>
          status === "active"
            ? prev.filter((r) => r.id !== id)
            : prev.map((r) => (r.id === id ? signed : r))
        );
      } else {
        setTeams((prev) =>
          status === "active"
            ? prev.filter((r) => r.id !== id)
            : prev.map((r) =>
                r.id === id ? { ...r, deleted_at: new Date().toISOString() } : r
              )
        );
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function handleRestore(id: number) {
    try {
      let res = await fetch(`/api/teams/${id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      if (res.status === 404) {
        res = await fetch(`/api/teams/${id}`, {
          method: "POST",
          credentials: "include",
        });
      }
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const restored = (body?.team as TeamRowWithArchived | undefined) ?? null;
      if (restored) {
        const logo = await signIfNeeded(restored.logo);
        const signed = { ...restored, logo };
        setTeams((prev) =>
          status === "archived"
            ? prev.filter((r) => r.id !== id)
            : prev.map((r) => (r.id === id ? signed : r))
        );
      } else {
        setTeams((prev) =>
          status === "archived"
            ? prev.filter((r) => r.id !== id)
            : prev.map((r) => (r.id === id ? { ...r, deleted_at: null } : r))
        );
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  function resetFilters() {
    setQ("");
    setStatus("active");
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <MobileTeamsTopBar
        q={q}
        onQChange={setQ}
        onOpenFilters={() => setFilterOpen(true)}
        onNew={openCreate}
        activeFilterCount={activeFilterCount}
        teamCount={filteredRows.length}
        statusLabel={
          status === "active" ? "Ενεργές" : status === "archived" ? "Αρχείο" : "Όλες"
        }
      />

      {loading ? (
        <p className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
          Φόρτωση…
        </p>
      ) : error ? (
        <p className="px-4 py-10 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-red-400">
          {error}
        </p>
      ) : filteredRows.length === 0 ? (
        <div className="px-4 py-12">
          <div className="border-2 border-dashed border-[#F3EFE6]/25 bg-[#13131d]/40 px-6 py-8 text-center">
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
              / 00 · Κατάλογος
            </span>
            <p className="mt-3 font-[var(--f-display)] text-xl font-black italic leading-tight">
              Δεν βρέθηκαν ομάδες
            </p>
            <p className="mt-2 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
              Δοκιμάστε άλλα κριτήρια ή δημιουργήστε νέα ομάδα.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-3 pt-3 pb-24 space-y-2.5">
          {filteredRows.map((row, idx) => (
            <MobileTeamCard
              key={row.id}
              row={row}
              index={idx}
              onTap={openPlayers}
              onMenu={setActionRow}
            />
          ))}
        </div>
      )}

      {filterOpen && (
        <MobileTeamsFilterSheet
          onClose={() => setFilterOpen(false)}
          status={status}
          onStatusChange={setStatus}
          teamCount={filteredRows.length}
          onReset={resetFilters}
        />
      )}

      {actionRow && (
        <MobileTeamActionSheet
          row={actionRow}
          onClose={() => setActionRow(null)}
          onEdit={(row) => {
            setActionRow(null);
            openEdit(row);
          }}
          onArchive={(id) => {
            setActionRow(null);
            handleArchive(id);
          }}
          onRestore={
            actionRow.deleted_at
              ? (id) => {
                  setActionRow(null);
                  handleRestore(id);
                }
              : undefined
          }
          onOpenPlayers={(row) => {
            setActionRow(null);
            openPlayers(row);
          }}
        />
      )}

      {playersFor && (
        <MobileTeamPlayersSheet
          team={playersFor}
          associations={playersByTeam[playersFor.id]}
          isLoading={!!playersLoading[playersFor.id]}
          error={playersErr[playersFor.id] ?? null}
          onClose={() => setPlayersFor(null)}
          onReload={() => loadPlayers(playersFor.id, true)}
        />
      )}

      {editorOpen && (
        <MobileTeamEditorSheet
          initial={editorRow}
          onClose={closeEditor}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
