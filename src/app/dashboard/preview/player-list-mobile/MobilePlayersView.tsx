// src/app/dashboard/preview/player-list-mobile/MobilePlayersView.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { safeJson } from "../../teams/teamHelpers";
import { parseSearchQuery, matchesSearch } from "@/app/lib/searchUtils";
import type { PlayerWithStats, PlayerFormPayload } from "../../players/types";
import PlayerEditorDrawer from "../../players/PlayerEditorDrawer";
import MobileTopBar from "./MobileTopBar";
import MobileFilterSheet, { type StatusFilter, type SortKey } from "./MobileFilterSheet";
import MobilePlayerCard, { type PlayerCardRow } from "./MobilePlayerCard";
import MobileActionSheet from "./MobileActionSheet";

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

function toRow(p: PlayerWithTeams): PlayerCardRow {
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

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

const SORT_LABELS: Record<SortKey, string> = {
  alpha: "Αλφαβητικά",
  goals: "Γκολ",
  assists: "Ασίστ",
  yellow: "Κίτρινες",
  red: "Κόκκινες",
  age: "Ηλικία",
  number: "Νούμερο",
};

export default function MobilePlayersView() {
  const [players, setPlayers] = useState<PlayerWithTeams[]>([]);
  const [teams, setTeams] = useState<TeamLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // filters
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 400);
  const [status, setStatus] = useState<StatusFilter>("active");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("alpha");
  const [topInput, setTopInput] = useState<string>("");

  // sheets / drawer
  const [filterOpen, setFilterOpen] = useState(false);
  const [actionRow, setActionRow] = useState<PlayerCardRow | null>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<PlayerWithStats | null>(null);
  const isEdit = !!editing?.id;

  // Refetch on status change OR debounced-q change (the API does name-ilike server-side too)
  async function fetchPlayers(serverQ: string, statusVal: StatusFilter) {
    setLoading(true);
    setError(null);
    try {
      let url = `/api/players`;
      const params = new URLSearchParams();
      // Only send the *text* portion of q to the server; field-prefixed terms are filtered client-side
      const parsed = parseSearchQuery(serverQ);
      const textOnly = parsed.text.join(" ").trim();
      if (textOnly) params.set("q", textOnly);
      if (statusVal === "archived") params.set("include", "archived");
      else if (statusVal === "all") params.set("include", "all");
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
    fetchPlayers(debouncedQ, status);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, debouncedQ]);

  useEffect(() => {
    fetchTeams();
  }, []);

  const allRows = useMemo(() => players.map(toRow), [players]);

  // Parse q once for client-side application
  const parsed = useMemo(() => parseSearchQuery(debouncedQ), [debouncedQ]);

  const filteredRows = useMemo(() => {
    let rows = allRows;

    // Admin team filter (numeric id, separate from q's team:)
    if (teamId != null) rows = rows.filter((r) => r.teams.some((t) => t.id === teamId));

    // q-syntax: team:X  → match team name with Greek/Latin variants
    if (parsed.team && parsed.team.length > 0) {
      rows = rows.filter((r) =>
        parsed.team!.some((needle) =>
          r.teams.some((t) => matchesSearch(t.name, needle))
        )
      );
    }

    // q-syntax: position:X
    if (parsed.position && parsed.position.length > 0) {
      rows = rows.filter((r) =>
        r.position
          ? parsed.position!.some((needle) => matchesSearch(r.position!, needle))
          : false
      );
    }

    // q-syntax: goals:>N / assists:>N (stats we have)
    if (parsed.minGoals !== undefined) {
      rows = rows.filter((r) => r.goals >= parsed.minGoals!);
    }
    if (parsed.minAssists !== undefined) {
      rows = rows.filter((r) => r.assists >= parsed.minAssists!);
    }
    // NOTE: parsed.minMatches is intentionally ignored — /api/players doesn't return matches

    // q-syntax: free text (name match with diacritic-tolerant variants)
    if (parsed.text.length > 0) {
      const needle = parsed.text.join(" ");
      rows = rows.filter((r) =>
        matchesSearch(`${r.first_name} ${r.last_name}`, needle)
      );
    }

    // Sort
    const sorted = [...rows];
    switch (sortKey) {
      case "goals":
        sorted.sort((a, b) => b.goals - a.goals);
        break;
      case "assists":
        sorted.sort((a, b) => b.assists - a.assists);
        break;
      case "yellow":
        sorted.sort((a, b) => b.yellow_cards - a.yellow_cards);
        break;
      case "red":
        sorted.sort((a, b) => b.red_cards - a.red_cards);
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
          `${a.last_name} ${a.first_name}`.localeCompare(
            `${b.last_name} ${b.first_name}`,
            "el"
          )
        );
        break;
    }

    // Top-N cap
    const n = Number(topInput);
    if (Number.isFinite(n) && n > 0) {
      return sorted.slice(0, Math.floor(n));
    }
    return sorted;
  }, [allRows, teamId, parsed, sortKey, topInput]);

  // Badge count for the filter button
  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (teamId != null) n++;
    if (status !== "active") n++;
    if (sortKey !== "alpha") n++;
    if (topInput.trim()) n++;
    // q-syntax modifiers each count
    if (parsed.team?.length) n++;
    if (parsed.position?.length) n++;
    if (parsed.minGoals !== undefined) n++;
    if (parsed.minAssists !== undefined) n++;
    return n;
  }, [teamId, status, sortKey, topInput, parsed]);

  // Active filter summary string (for the "active filters" row in the sheet)
  const summaryParts = useMemo(() => {
    const parts: string[] = [];
    parts.push(`Ταξ · ${SORT_LABELS[sortKey]}`);
    if (status !== "active") {
      parts.push(`Κατάσταση · ${status === "archived" ? "Αρχείο" : "Όλοι"}`);
    }
    if (teamId != null) {
      const t = teams.find((x) => x.id === teamId);
      if (t) parts.push(`Ομάδα · ${t.name}`);
    }
    if (parsed.team?.length) parts.push(`team: ${parsed.team.join(", ")}`);
    if (parsed.position?.length) parts.push(`pos: ${parsed.position.join(", ")}`);
    if (parsed.minGoals !== undefined) parts.push(`goals ≥ ${parsed.minGoals}`);
    if (parsed.minAssists !== undefined) parts.push(`assists ≥ ${parsed.minAssists}`);
    if (parsed.text.length > 0) parts.push(`«${parsed.text.join(" ")}»`);
    if (topInput.trim()) parts.push(`Top · ${topInput.trim()}`);
    return parts;
  }, [sortKey, status, teamId, teams, parsed, topInput]);

  function openCreate() {
    setEditing(null);
    setShowEditor(true);
  }
  function openEdit(row: PlayerCardRow) {
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
        await fetchPlayers(debouncedQ, status);
      } else {
        const res = await fetch(`/api/players`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        await fetchPlayers(debouncedQ, status);
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
    setSortKey("alpha");
    setTopInput("");
  }

  return (
    <div className="min-h-screen bg-[#0a0a14] text-[#F3EFE6]">
      <MobileTopBar
        q={q}
        onQChange={setQ}
        onOpenFilters={() => setFilterOpen(true)}
        onNew={openCreate}
        activeFilterCount={activeFilterCount}
        playerCount={filteredRows.length}
        sortLabel={SORT_LABELS[sortKey]}
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
              Δεν βρέθηκαν παίκτες
            </p>
            <p className="mt-2 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">
              Δοκιμάστε άλλα κριτήρια αναζήτησης.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-3 pt-3 pb-24 space-y-2.5">
          {filteredRows.map((row, idx) => (
            <MobilePlayerCard
              key={row.id}
              row={row}
              index={idx}
              sortKey={sortKey}
              onTap={openEdit}
              onMenu={setActionRow}
            />
          ))}
        </div>
      )}

      <MobileFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        teams={teams}
        teamId={teamId}
        onTeamChange={setTeamId}
        status={status}
        onStatusChange={setStatus}
        sortKey={sortKey}
        onSortChange={setSortKey}
        topInput={topInput}
        onTopChange={setTopInput}
        playerCount={filteredRows.length}
        summaryParts={summaryParts}
        onReset={resetFilters}
      />

      <MobileActionSheet
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
          status === "archived"
            ? (id) => {
                setActionRow(null);
                handleRestore(id);
              }
            : undefined
        }
      />

      <PlayerEditorDrawer
        open={showEditor}
        onClose={closeEditor}
        player={editing}
        onSubmit={handleSave}
      />
    </div>
  );
}
