// src/app/dashboard/preview/player-list/AdminPlayersListView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "../../teams/teamHelpers";
import type { PlayerWithStats, PlayerFormPayload } from "../../players/types";
import PlayerEditorDrawer from "../../players/PlayerEditorDrawer";
import AdminPlayersFilterHeader, { type StatusFilter, type SortKey } from "./AdminPlayersFilterHeader";
import AdminPlayersList, { type PlayerListRow } from "./AdminPlayersList";

type TeamLite = { id: number; name: string; logo?: string | null };
type PlayerWithTeams = PlayerWithStats & {
  player_teams?: { team_id: number; teams: TeamLite | null }[];
};

function isDummyPlayer(p: any) {
  const v =
    p?.is_dummy ??
    p?.isDummy ??
    p?.dummy ??
    (p?.meta && (p.meta.is_dummy ?? p.meta.isDummy));
  if (v === true) return true;
  if (v === false || v == null) return false;
  if (typeof v === "number") return v === 1;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes";
  }
  return false;
}

function normalizePlayer(p: PlayerWithTeams): PlayerWithTeams {
  const ps: any = (p as any).player_statistics;
  const arr = Array.isArray(ps) ? ps : ps ? [ps] : [];
  const pt: any = (p as any).player_teams;
  const ptArr = Array.isArray(pt) ? pt : pt ? [pt] : [];
  return { ...p, player_statistics: arr as any, player_teams: ptArr };
}

function firstStats(p: PlayerWithStats) {
  const ps: any = (p as any).player_statistics;
  if (Array.isArray(ps)) return ps[0] ?? null;
  if (ps && typeof ps === "object") return ps;
  return null;
}

function toRow(p: PlayerWithTeams): PlayerListRow {
  const s = firstStats(p);
  const teams: TeamLite[] = (p.player_teams ?? [])
    .map((pt) => pt.teams)
    .filter((t): t is TeamLite => !!t);
  return {
    id: p.id,
    first_name: (p as any).first_name ?? "",
    last_name: (p as any).last_name ?? "",
    photo: (p as any).photo ?? null,
    position: (p as any).position ?? null,
    player_number: (p as any).player_number ?? null,
    height_cm: (p as any).height_cm ?? null,
    deleted_at: (p as any).deleted_at ?? null,
    age: s?.age ?? null,
    goals: s?.total_goals ?? 0,
    assists: s?.total_assists ?? 0,
    yellow_cards: s?.yellow_cards ?? 0,
    red_cards: s?.red_cards ?? 0,
    blue_cards: s?.blue_cards ?? 0,
    teams,
    raw: p,
  };
}

export default function AdminPlayersListView() {
  const [players, setPlayers] = useState<PlayerWithTeams[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("alpha");

  // editor drawer
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<PlayerWithStats | null>(null);
  const isEdit = !!editing?.id;

  async function fetchPlayers() {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/players`;
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status === "archived") params.set("include", "archived");
      else if (status === "all") params.set("include", "all");
      const qs = params.toString();
      if (qs) url += `?${qs}`;

      const res = await fetch(url, { credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const rows = (body?.players as PlayerWithTeams[]) ?? [];
      const normalized = rows.map(normalizePlayer).filter((p) => !isDummyPlayer(p));
      setPlayers(normalized);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeams() {
    try {
      const res = await fetch(`/api/teams`, { credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) return;
      const rows = (body?.teams as TeamLite[]) ?? [];
      setTeams(rows);
    } catch {
      // non-blocking
    }
  }

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    fetchTeams();
  }, []);

  // Derived rows
  const allRows = useMemo(() => players.map(toRow), [players]);

  // Position options derived from current player set
  const positionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRows) if (r.position) set.add(r.position);
    return Array.from(set).sort();
  }, [allRows]);

  // Apply client-side filters (search is also server-applied via q on fetch,
  // but team/position/sort are client-side over fetched set)
  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (teamId != null) {
      rows = rows.filter((r) => r.teams.some((t) => t.id === teamId));
    }
    if (position) {
      rows = rows.filter((r) => (r.position ?? "") === position);
    }
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((r) =>
        `${r.first_name} ${r.last_name}`.toLowerCase().includes(needle)
      );
    }
    const sorted = [...rows];
    switch (sortKey) {
      case "goals":
        sorted.sort((a, b) => b.goals - a.goals);
        break;
      case "assists":
        sorted.sort((a, b) => b.assists - a.assists);
        break;
      case "age":
        sorted.sort((a, b) => (b.age ?? -1) - (a.age ?? -1));
        break;
      case "number":
        sorted.sort((a, b) => (a.player_number ?? 9999) - (b.player_number ?? 9999));
        break;
      case "alpha":
      default:
        sorted.sort((a, b) =>
          `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`, "el")
        );
        break;
    }
    return sorted;
  }, [allRows, teamId, position, q, sortKey]);

  function openCreate() {
    setEditing(null);
    setShowEditor(true);
  }
  function openEdit(row: PlayerListRow) {
    setEditing(row.raw as PlayerWithStats);
    setShowEditor(true);
  }
  function closeEditor() {
    setShowEditor(false);
    setEditing(null);
  }

  async function handleSave(payload: PlayerFormPayload) {
    try {
      if (isEdit) {
        const res = await fetch(`/api/players/${editing!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        // simplest: re-fetch to refresh team/stat joins
        await fetchPlayers();
      } else {
        const res = await fetch(`/api/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        await fetchPlayers();
      }
      closeEditor();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function handleArchive(id: number) {
    if (
      !confirm(
        "Αρχειοθέτηση παίκτη; Θα αποκρυφτεί από τα ρόστερ και τους νέους αγώνες, αλλά τα ιστορικά στατιστικά του διατηρούνται."
      )
    )
      return;
    try {
      const res = await fetch(`/api/players/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function handleRestore(id: number) {
    try {
      const res = await fetch(`/api/players/${id}/restore`, {
        method: "POST",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  function resetFilters() {
    setQ("");
    setTeamId(null);
    setPosition(null);
    setSortKey("alpha");
    // keep status as user chose it (most common is "active")
  }

  return (
    <div className="flex flex-col">
      <AdminPlayersFilterHeader
        q={q}
        onQChange={setQ}
        teams={teams}
        teamId={teamId}
        onTeamChange={setTeamId}
        positions={positionOptions}
        position={position}
        onPositionChange={setPosition}
        status={status}
        onStatusChange={setStatus}
        sortKey={sortKey}
        onSortChange={setSortKey}
        playerCount={filteredRows.length}
        onReset={resetFilters}
        onNew={openCreate}
      />

      {loading ? (
        <p className="px-6 py-8 text-white/70">Loading…</p>
      ) : error ? (
        <p className="px-6 py-8 text-red-400">{error}</p>
      ) : (
        <AdminPlayersList
          rows={filteredRows}
          onRowClick={openEdit}
          onEdit={openEdit}
          onArchive={handleArchive}
          onRestore={status === "archived" ? handleRestore : undefined}
        />
      )}

      <PlayerEditorDrawer
        open={showEditor}
        onClose={closeEditor}
        player={editing}
        onSubmit={handleSave}
      />
    </div>
  );
}
