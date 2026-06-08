// src/app/dashboard/preview/teams-v2/MobileTeamsView.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { safeJson, signIfNeeded } from "../../teams/teamHelpers";
import type { TeamRow, PlayerAssociation } from "@/app/lib/types";

import MobileTeamsTopBar from "./MobileTeamsTopBar";
import MobileTeamCard, { type TeamCardRow } from "./MobileTeamCard";
import MobileTeamActionSheet from "./MobileTeamActionSheet";
import MobileTeamPlayersSheet from "./MobileTeamPlayersSheet";
import MobileTeamEditorSheet from "./MobileTeamEditorSheet";
import MobileTeamsFilterSheet, { type StatusFilter } from "./MobileTeamsFilterSheet";
import PlayerEditorDrawer from "../../players/PlayerEditorDrawer";
import type { PlayerWithStats, PlayerFormPayload } from "../../players/types";

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

  // player drawer
  const [playerEditorOpen, setPlayerEditorOpen] = useState(false);
  const [playerEditing, setPlayerEditing] = useState<PlayerWithStats | null>(null);
  // when set, a newly-created player should be attached to this team id
  const playerCreateForTeamRef = useRef<number | null>(null);

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

  async function mergeSavedTeam(saved: TeamRow) {
    const logo = await signIfNeeded(saved.logo);
    const signed = { ...(saved as TeamRowWithArchived), logo };
    setTeams((prev) => {
      const exists = prev.some((t) => t.id === signed.id);
      if (exists) return prev.map((t) => (t.id === signed.id ? signed : t));
      return [signed, ...prev];
    });
  }

  async function handleSaved(saved: TeamRow) {
    await mergeSavedTeam(saved);
    closeEditor();
  }

  async function handleAutoSaved(saved: TeamRow) {
    await mergeSavedTeam(saved);
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

  function openEditPlayer(player: PlayerWithStats) {
    playerCreateForTeamRef.current = null;
    setPlayerEditing(player);
    setPlayerEditorOpen(true);
  }

  function openCreatePlayer(teamId: number) {
    playerCreateForTeamRef.current = teamId;
    setPlayerEditing(null);
    setPlayerEditorOpen(true);
  }

  function closePlayerEditor() {
    setPlayerEditorOpen(false);
    setPlayerEditing(null);
    playerCreateForTeamRef.current = null;
  }

  async function handlePlayerSave(payload: PlayerFormPayload) {
    const editingId = playerEditing?.id;
    try {
      if (editingId) {
        const res = await fetch(`/api/players/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        if (playersFor) await loadPlayers(playersFor.id, true);
      } else {
        const res = await fetch(`/api/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        const created = body?.player as { id: number } | undefined;
        const attachTo = playerCreateForTeamRef.current;
        if (created && attachTo) {
          const attachRes = await fetch(`/api/teams/${attachTo}/players`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ player_id: created.id }),
          });
          const attachBody = await safeJson(attachRes);
          if (!attachRes.ok)
            throw new Error(attachBody?.error || `HTTP ${attachRes.status}`);
          await loadPlayers(attachTo, true);
        }
      }
      closePlayerEditor();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <MobileTeamsTopBar
        q={q}
        onQChange={setQ}
        onOpenFilters={() => setFilterOpen(true)}
        onRefresh={() => fetchTeams(status)}
        onNew={openCreate}
        activeFilterCount={activeFilterCount}
        teamCount={filteredRows.length}
        statusLabel={
          status === "active" ? "Ενεργές" : status === "archived" ? "Αρχείο" : "Όλες"
        }
        refreshing={loading}
      />

      <div className="mx-auto max-w-7xl px-3 sm:px-4 pt-4 pb-24">
        {loading ? (
          <p className="py-10 text-center text-sm text-white/55">Φόρτωση…</p>
        ) : error ? (
          <p className="py-10 text-center text-sm text-red-400">{error}</p>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/40 px-6 py-12 text-center">
            <p className="text-base font-semibold text-white">Δεν βρέθηκαν ομάδες</p>
            <p className="mt-1.5 text-sm text-white/55">
              Δοκιμάστε άλλα κριτήρια ή δημιουργήστε νέα ομάδα.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {filteredRows.map((row) => (
              <MobileTeamCard
                key={row.id}
                row={row}
                onTap={openPlayers}
                onMenu={setActionRow}
              />
            ))}
          </div>
        )}
      </div>

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
          onEditPlayer={openEditPlayer}
          onCreatePlayer={() => openCreatePlayer(playersFor.id)}
        />
      )}

      {editorOpen && (
        <MobileTeamEditorSheet
          initial={editorRow}
          onClose={closeEditor}
          onSaved={handleSaved}
          onAutoSaved={handleAutoSaved}
        />
      )}

      {playerEditorOpen && (
        <PlayerEditorDrawer
          open={playerEditorOpen}
          onClose={closePlayerEditor}
          player={playerEditing}
          onSubmit={handlePlayerSave}
        />
      )}
    </div>
  );
}
