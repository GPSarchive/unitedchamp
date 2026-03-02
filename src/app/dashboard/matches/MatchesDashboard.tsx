"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Edit3,
  Plus,
  Trash2,
  RefreshCw,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Trophy,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase/supabaseClient";

import RowEditor from "./RowEditor";
import PostponeDialog from "./PostponeDialog";
import PlayerPhoto from "@/app/dashboard/players/PlayerPhoto";
import type {
  Id,
  TeamLite,
  MatchRow as BaseMatchRow,
  MaybeArray,
} from "@/app/lib/types";
import type { MatchStatSummary } from "./page";
import {
  SoccerBall,
  YellowCard,
  RedCard,
  BlueCard,
  FinishedIcon,
  ScheduledIcon,
  PostponedIcon,
} from "@/app/lib/MatchIcons";

// Extend the shared MatchRow with joined objects
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
  defaultTournamentId?: number | null;
  statsByMatch?: Record<number, MatchStatSummary>;
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
  return `${day}/${m}/${y} ${hh}:${mm}`;
}

function one<T>(v: MaybeArray<T> | undefined): T | null {
  return Array.isArray(v) ? v[0] ?? null : ((v as unknown) as T | null) ?? null;
}

function stageLabel(r: MatchRow): string | null {
  const s = one(r.stage);
  const g = one(r.grp);
  const parts: string[] = [];
  if (s?.name) parts.push(s.name);
  if (g?.name) parts.push(g.name);
  if (typeof r.matchday === "number") parts.push(`ΑΓ ${r.matchday}`);
  if (typeof r.round === "number") parts.push(`R${r.round}`);
  if (typeof r.bracket_pos === "number") parts.push(`Pos ${r.bracket_pos}`);
  return parts.length ? parts.join(" · ") : null;
}

const PAGE_SIZE = 20;

export default function MatchesDashboard({
  initialTeams = [],
  initialMatches = [],
  defaultTournamentId = null,
  statsByMatch = {},
}: MatchesDashboardProps) {
  const router = useRouter();

  const [teams, setTeams] = useState<TeamLite[]>(initialTeams);
  const [rows, setRows] = useState<MatchRow[]>(initialMatches);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<Id | null>(null);
  const [postponingId, setPostponingId] = useState<Id | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [tournamentFilter, setTournamentFilter] = useState<string>("all");
  const [teamQuery, setTeamQuery] = useState<string>("");
  const [sortMode, setSortMode] = useState<"newest" | "oldest" | "updated">("newest");
  const [page, setPage] = useState<number>(1);

  useEffect(() => setTeams(initialTeams), [initialTeams]);
  useEffect(() => setRows(initialMatches), [initialMatches]);

  useEffect(() => {
    if (defaultTournamentId != null) {
      setTournamentFilter(String(defaultTournamentId));
    }
  }, [defaultTournamentId]);

  useEffect(() => {
    setPage(1);
  }, [tournamentFilter, teamQuery, sortMode, rows.length]);

  const editingRow = useMemo(
    () => rows.find((r) => r.id === editingId),
    [rows, editingId]
  );

  const postponingRow = useMemo(
    () => rows.find((r) => r.id === postponingId),
    [rows, postponingId]
  );

  async function refreshFromServer() {
    setIsRefreshing(true);
    setError(null);
    try {
      router.refresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 300);
    }
  }

  async function remove(id: Id) {
    if (!confirm("Delete this match? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/matches/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const base = (data as any)?.error ?? `HTTP ${res.status}`;
        const dbg =
          (data as any)?.__debug?.message ||
          (data as any)?.__debug?.details ||
          (data as any)?.__debug?.hint ||
          "";
        throw new Error(dbg ? `${base} — ${dbg}` : base);
      }
      setRows((r) => r.filter((x) => x.id !== id));
      await refreshFromServer();
    } catch (e: any) {
      alert(e.message ?? String(e));
    }
  }

  // Build tournament options from rows
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

  const postponedMatches = useMemo(
    () => rows.filter((r) => r.status === "postponed"),
    [rows]
  );

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

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return displayRows.slice(start, start + PAGE_SIZE);
  }, [displayRows, page]);

  /* ─── Status badge ─── */
  function StatusBadge({ status }: { status: MatchRow["status"] }) {
    if (status === "finished")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-600/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300">
          <FinishedIcon className="h-3 w-3" />
          Ολοκληρώθηκε
        </span>
      );
    if (status === "postponed")
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-400/30 bg-orange-600/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-orange-300">
          <PostponedIcon className="h-3 w-3" />
          Αναβλήθηκε
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white/70">
        <ScheduledIcon className="h-3 w-3" />
        Προγρ.
      </span>
    );
  }

  /* ─── Stats summary chips ─── */
  function MatchStatsSummary({ matchId, teamAId, teamBId }: { matchId: number; teamAId: Id; teamBId: Id }) {
    const summary = statsByMatch[matchId];
    if (!summary) return null;

    const totalGoals = summary.scorers.reduce((sum, s) => sum + s.goals + s.own_goals, 0);
    const totalYellow = summary.cards.reduce((sum, c) => sum + c.yellow_cards, 0);
    const totalRed = summary.cards.reduce((sum, c) => sum + c.red_cards, 0);
    const totalBlue = summary.cards.reduce((sum, c) => sum + c.blue_cards, 0);

    if (totalGoals === 0 && totalYellow === 0 && totalRed === 0 && totalBlue === 0)
      return null;

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {totalGoals > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/8 px-1.5 py-0.5 text-xs font-medium text-white">
            <SoccerBall className="h-3.5 w-3.5 text-emerald-400" />
            {totalGoals}
          </span>
        )}
        {totalYellow > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-yellow-400/20 bg-yellow-500/10 px-1.5 py-0.5 text-xs font-medium text-yellow-300">
            <YellowCard className="h-4 w-3" />
            {totalYellow}
          </span>
        )}
        {totalRed > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-red-400/20 bg-red-500/10 px-1.5 py-0.5 text-xs font-medium text-red-300">
            <RedCard className="h-4 w-3" />
            {totalRed}
          </span>
        )}
        {totalBlue > 0 && (
          <span className="inline-flex items-center gap-1 rounded-md border border-blue-400/20 bg-blue-500/10 px-1.5 py-0.5 text-xs font-medium text-blue-300">
            <BlueCard className="h-4 w-3" />
            {totalBlue}
          </span>
        )}
      </div>
    );
  }

  /* ─── Player event cards (scorers + card recipients) ─── */
  function ScorersList({ matchId, teamAId, teamBId }: { matchId: number; teamAId: Id; teamBId: Id }) {
    const summary = statsByMatch[matchId];
    if (!summary || (summary.scorers.length === 0 && summary.cards.length === 0)) return null;

    type PlayerEvent = {
      player_id: number;
      team_id: number;
      first_name: string | null;
      last_name: string | null;
      photo: string | null;
      goals: number;
      own_goals: number;
      yellow_cards: number;
      red_cards: number;
      blue_cards: number;
    };

    const byPlayer = new Map<number, PlayerEvent>();
    for (const s of summary.scorers) {
      byPlayer.set(s.player_id, {
        player_id: s.player_id, team_id: s.team_id,
        first_name: s.first_name, last_name: s.last_name, photo: s.photo,
        goals: s.goals, own_goals: s.own_goals,
        yellow_cards: 0, red_cards: 0, blue_cards: 0,
      });
    }
    for (const c of summary.cards) {
      const ex = byPlayer.get(c.player_id);
      if (ex) {
        ex.yellow_cards = c.yellow_cards;
        ex.red_cards = c.red_cards;
        ex.blue_cards = c.blue_cards;
      } else {
        byPlayer.set(c.player_id, {
          player_id: c.player_id, team_id: c.team_id,
          first_name: c.first_name, last_name: c.last_name, photo: c.photo,
          goals: 0, own_goals: 0,
          yellow_cards: c.yellow_cards, red_cards: c.red_cards, blue_cards: c.blue_cards,
        });
      }
    }

    return (
      <div className="flex flex-wrap gap-1.5 mt-1">
        {Array.from(byPlayer.values()).map((p) => {
          const name = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || `#${p.player_id}`;
          const shortName = p.last_name || name;
          const isTeamA = String(p.team_id) === String(teamAId);
          return (
            <div key={p.player_id} title={name} className="flex flex-col items-center w-10 shrink-0">
              {/* Photo with icon badges */}
              <div className="relative w-10 h-10 rounded-md overflow-hidden border border-white/15 bg-zinc-900 shrink-0">
                {p.photo ? (
                  <PlayerPhoto path={p.photo} alt={name} className="w-full h-full object-cover" />
                ) : (
                  <div className={`w-full h-full flex items-center justify-center text-[11px] font-bold ${isTeamA ? "text-emerald-400" : "text-sky-400"}`}>
                    {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "") || "?"}
                  </div>
                )}
                {/* Goal badges – top-left */}
                {(p.goals > 0 || p.own_goals > 0) && (
                  <div className="absolute top-0.5 left-0.5 flex flex-col gap-0.5">
                    {p.goals > 0 && (
                      <span className="flex items-center gap-0.5 rounded bg-black/75 px-0.5 leading-none">
                        <SoccerBall className={`h-2.5 w-2.5 ${isTeamA ? "text-emerald-400" : "text-sky-400"}`} />
                        {p.goals > 1 && <span className="text-[8px] font-bold text-white">×{p.goals}</span>}
                      </span>
                    )}
                    {p.own_goals > 0 && (
                      <span className="flex items-center gap-0.5 rounded bg-black/75 px-0.5 leading-none">
                        <SoccerBall className="h-2.5 w-2.5 text-orange-400" />
                        <span className="text-[8px] font-bold text-orange-300">OG</span>
                      </span>
                    )}
                  </div>
                )}
                {/* Card badges – top-right */}
                {(p.yellow_cards > 0 || p.red_cards > 0 || p.blue_cards > 0) && (
                  <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5 items-end">
                    {p.yellow_cards > 0 && <YellowCard className="h-3.5 w-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                    {p.red_cards > 0 && <RedCard className="h-3.5 w-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                    {p.blue_cards > 0 && <BlueCard className="h-3.5 w-2.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />}
                  </div>
                )}
              </div>
              {/* Name */}
              <span className={`text-[9px] mt-0.5 w-full text-center truncate leading-tight ${isTeamA ? "text-emerald-300/80" : "text-sky-300/80"}`}>
                {shortName}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  /* ─── Pagination ─── */
  function Pagination() {
    const canPrev = page > 1;
    const canNext = page < totalPages;
    const paginationBtn =
      "min-h-[40px] flex-1 md:flex-none inline-flex items-center justify-center gap-1 px-2.5 py-1 rounded-lg border border-white/12 bg-zinc-950/80 text-white/80 hover:bg-zinc-900 hover:text-white disabled:opacity-35 transition-colors text-sm";

    return (
      <div className="flex flex-col md:flex-row items-center gap-3 justify-between px-4 py-2.5 bg-gradient-to-r from-zinc-950 to-black border-t border-white/8">
        <div className="text-xs text-white/50 order-2 md:order-1">
          Εμφάνιση{" "}
          <span className="text-white/80">
            {displayRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, displayRows.length)}
          </span>{" "}
          από <span className="text-white/80">{displayRows.length}</span>
        </div>
        <div className="flex items-center gap-1 w-full md:w-auto order-1 md:order-2">
          <button onClick={() => setPage(1)} disabled={!canPrev} className={paginationBtn} aria-label="Πρώτη">
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={!canPrev} className={paginationBtn} aria-label="Προηγούμενη">
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden md:inline">Προηγ.</span>
          </button>
          <span className="px-3 text-xs text-white/60 hidden md:inline">
            <span className="text-white">{page}</span> / <span className="text-white">{totalPages}</span>
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={!canNext} className={paginationBtn} aria-label="Επόμενη">
            <span className="hidden md:inline">Επόμ.</span>
            <ChevronRight className="h-4 w-4" />
          </button>
          <button onClick={() => setPage(totalPages)} disabled={!canNext} className={paginationBtn} aria-label="Τελευταία">
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* ─── Header ─── */}
      <header className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between rounded-xl border border-emerald-400/20 bg-gradient-to-r from-zinc-950 via-black to-zinc-950 px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex items-center gap-2.5">
          <SoccerBall className="h-6 w-6 text-emerald-400" />
          <h2 className="text-xl font-bold">
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-white to-emerald-300">
              Αγώνες
            </span>
          </h2>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
          <button
            onClick={refreshFromServer}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-white/12 bg-zinc-950/80 text-white/80 hover:bg-zinc-900 hover:text-white disabled:opacity-60 transition-colors"
            disabled={isRefreshing}
          >
            <RefreshCw className={`${isRefreshing ? "animate-spin" : ""} h-4 w-4`} />
            <span className="hidden sm:inline text-sm">Ανανέωση</span>
          </button>
          <button
            onClick={() => setCreating(true)}
            className="min-h-[44px] inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/25 text-white hover:bg-emerald-700/40 transition-colors shadow-[0_0_0_1px_rgba(16,185,129,0.25)_inset]"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Νέος αγώνας</span>
          </button>
        </div>
      </header>

      {/* ─── Filters ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl border border-white/8 bg-zinc-950/60 p-3 ring-1 ring-white/4">
        <div className="relative flex items-center">
          <Search className="absolute left-3 h-4 w-4 text-white/40 pointer-events-none" />
          <input
            type="text"
            value={teamQuery}
            onChange={(e) => setTeamQuery(e.target.value)}
            placeholder="Αναζήτηση ομάδας…"
            className="pl-9 pr-3 py-2 min-h-[44px] rounded-lg bg-black/60 text-white ring-1 ring-white/10 placeholder:text-white/35 focus:outline-none focus:ring-emerald-400/40 w-full text-sm transition-shadow"
          />
        </div>

        <select
          value={tournamentFilter}
          onChange={(e) => setTournamentFilter(e.target.value)}
          className="px-3 py-2 min-h-[44px] rounded-lg bg-black/60 text-white ring-1 ring-white/10 focus:outline-none focus:ring-emerald-400/40 w-full text-sm"
        >
          <option value="all">Όλες οι διοργανώσεις</option>
          {tournamentOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2">
          <span className="text-xs text-white/50 shrink-0">Ταξινόμηση</span>
          <div className="grid grid-cols-3 gap-1.5 flex-1">
            {(["newest", "oldest", "updated"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSortMode(mode)}
                className={`min-h-[40px] inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg border text-xs transition-colors ${
                  sortMode === mode
                    ? "border-emerald-400/40 bg-emerald-700/25 text-white"
                    : "border-white/10 bg-black/40 text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                {mode === "oldest" ? (
                  <><Calendar className="h-3.5 w-3.5" /> Παλαιότ.</>
                ) : mode === "newest" ? (
                  <><Calendar className="h-3.5 w-3.5" /> Νεότερα</>
                ) : (
                  <><Clock className="h-3.5 w-3.5" /> Αλλαγές</>
                )}
              </button>
            ))}
          </div>
        </div>

        {(tournamentFilter !== "all" || teamQuery || sortMode !== "newest") && (
          <button
            onClick={() => {
              setTournamentFilter("all");
              setTeamQuery("");
              setSortMode("newest");
            }}
            className="sm:col-span-2 lg:col-span-3 inline-flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-lg border border-white/10 bg-black/40 text-white/70 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            Επαναφορά φίλτρων
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-900/25 p-3 text-red-200 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* ─── Postponed Matches Alert Section ─── */}
      {postponedMatches.length > 0 && (
        <div className="rounded-2xl border border-orange-400/20 overflow-hidden shadow-xl shadow-black/40">
          <div className="bg-gradient-to-r from-orange-950/60 to-zinc-950 px-4 py-3 border-b border-orange-400/20 flex items-center gap-3">
            <PostponedIcon className="h-5 w-5 text-orange-400 shrink-0" />
            <div>
              <h3 className="font-bold text-white text-base">
                Αναβληθέντες Αγώνες
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-orange-500/30 border border-orange-400/30 text-orange-200 text-[10px] font-bold">
                  {postponedMatches.length}
                </span>
              </h3>
              <p className="text-xs text-orange-200/60 mt-0.5">
                Αναμένουν επιβεβαίωση νέας ημερομηνίας
              </p>
            </div>
          </div>

          <div className="divide-y divide-white/8">
            {postponedMatches.map((r) => {
              const a = one<TeamLite>(r.teamA);
              const b = one<TeamLite>(r.teamB);
              const tourName =
                one(r.tournament)?.name ??
                (r.tournament_id ? `Tournament #${r.tournament_id}` : "—");
              const stageTxt = stageLabel(r);

              return (
                <div
                  key={r.id}
                  className="p-4 bg-orange-950/15 hover:bg-orange-950/25 transition-colors"
                >
                  <div className="flex flex-col md:flex-row md:items-center gap-4">
                    <div className="flex-1 space-y-2">
                      {/* Teams */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {a?.logo && (
                          <img src={a.logo} alt={a.name} className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10" />
                        )}
                        <span className="font-semibold text-white">{a?.name ?? r.team_a_id}</span>
                        <span className="text-white/40 text-sm">vs</span>
                        <span className="font-semibold text-white">{b?.name ?? r.team_b_id}</span>
                        {b?.logo && (
                          <img src={b.logo} alt={b.name} className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10" />
                        )}
                      </div>
                      {/* Tour + stage */}
                      <div className="flex flex-wrap gap-1.5 text-xs">
                        <span className="px-2 py-0.5 rounded bg-white/8 border border-white/10 text-white/70">{tourName}</span>
                        {stageTxt && <span className="px-2 py-0.5 rounded bg-white/8 border border-white/10 text-white/70">{stageTxt}</span>}
                      </div>
                      {/* Dates */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-white/70">
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-white/40" />
                          <span className="text-white/50">Αρχική:</span>
                          {r.original_match_date ? isoToDTString(r.original_match_date) : "—"}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-orange-400" />
                          <span className="text-white/50">Νέα:</span>
                          <span className={r.match_date && r.match_date !== r.original_match_date ? "text-orange-300" : "text-white/40"}>
                            {r.match_date && r.match_date !== r.original_match_date
                              ? isoToDTString(r.match_date)
                              : "ΘΑ ΑΝΑΚΟΙΝΩΘΕΙ"}
                          </span>
                        </span>
                      </div>
                      {r.postponement_reason && (
                        <p className="text-xs text-orange-200/70 bg-orange-500/8 rounded px-2 py-1 border border-orange-400/15">
                          {r.postponement_reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2 shrink-0">
                      <button
                        onClick={() => setPostponingId(r.id)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-400/30 bg-emerald-700/20 hover:bg-emerald-700/35 text-white text-sm transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Ενημέρωση
                      </button>
                      <button
                        onClick={() => setEditingId(r.id)}
                        className="min-h-[40px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-zinc-950 hover:bg-zinc-900 text-white text-sm transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        Επεξεργασία
                      </button>
                    </div>
                  </div>

                  {editingId === r.id && (
                    <div className="mt-4 p-4 bg-black/40 rounded-xl border border-white/10">
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
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── New match editor ─── */}
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

      {/* ─── Match list ─── */}
      {rows.length === 0 ? (
        <div className="rounded-xl border border-white/8 bg-white/3 p-12 text-center">
          <SoccerBall className="h-10 w-10 text-white/20 mx-auto mb-3" />
          <p className="text-white/50 text-sm">Δεν υπάρχουν αγώνες ακόμα.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-white/10 overflow-hidden shadow-xl shadow-black/40">
          <Pagination />

          {/* ── Mobile card view ── */}
          <ul className="md:hidden divide-y divide-white/8">
            {pagedRows.map((r, i) => {
              const a = one<TeamLite>(r.teamA);
              const b = one<TeamLite>(r.teamB);
              const tourName =
                one(r.tournament)?.name ??
                (r.tournament_id ? `Tournament #${r.tournament_id}` : "—");
              const stageTxt = stageLabel(r);

              return (
                <li
                  key={r.id}
                  className={`${i % 2 ? "bg-[#0b0b10]" : "bg-[#0f1015]"} transition-colors`}
                >
                  {/* Card top: date + status */}
                  <div className={`flex items-center justify-between px-3 py-2 border-b border-white/6 ${
                    r.status === "finished"
                      ? "border-l-2 border-l-emerald-500/70"
                      : r.status === "postponed"
                      ? "border-l-2 border-l-orange-500/70"
                      : "border-l-2 border-l-white/20"
                  }`}>
                    <span className="text-xs text-white/50 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {r.match_date ? isoToDTString(r.match_date) : "—"}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>

                  {/* Main match info */}
                  <div className="px-3 py-3 space-y-2.5">
                    {/* Teams + score */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {a?.logo && (
                          <img src={a.logo} alt={a.name} className="h-8 w-8 rounded-full object-contain ring-1 ring-white/10 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-white text-sm truncate">{a?.name ?? r.team_a_id}</p>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-lg bg-black/60 border border-white/10">
                        <span className={`text-xl font-black tabular-nums ${r.winner_team_id && r.winner_team_id === r.team_a_id ? "text-amber-400" : "text-white"}`}>
                          {r.team_a_score ?? "—"}
                        </span>
                        <span className="text-white/30 text-sm font-medium">:</span>
                        <span className={`text-xl font-black tabular-nums ${r.winner_team_id && r.winner_team_id === r.team_b_id ? "text-amber-400" : "text-white"}`}>
                          {r.team_b_score ?? "—"}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 min-w-0 flex-1 justify-end">
                        <div className="min-w-0 text-right">
                          <p className="font-bold text-white text-sm truncate">{b?.name ?? r.team_b_id}</p>
                        </div>
                        {b?.logo && (
                          <img src={b.logo} alt={b.name} className="h-8 w-8 rounded-full object-contain ring-1 ring-white/10 shrink-0" />
                        )}
                      </div>
                    </div>

                    {/* Tournament + stage */}
                    <div className="flex flex-wrap gap-1 text-xs">
                      <span className="px-2 py-0.5 rounded bg-white/6 border border-white/8 text-white/60">{tourName}</span>
                      {stageTxt && <span className="px-2 py-0.5 rounded bg-white/6 border border-white/8 text-white/60">{stageTxt}</span>}
                    </div>

                    {/* Stats summary */}
                    <MatchStatsSummary matchId={r.id} teamAId={r.team_a_id} teamBId={r.team_b_id} />

                    {/* Scorers */}
                    <ScorersList matchId={r.id} teamAId={r.team_a_id} teamBId={r.team_b_id} />

                    {/* Winner badge */}
                    {r.winner_team_id && (
                      <div className="flex items-center gap-1.5 text-xs text-amber-300">
                        <Trophy className="h-3.5 w-3.5" />
                        Νικητής: {
                          r.winner_team_id === r.team_a_id
                            ? a?.name ?? `#${r.team_a_id}`
                            : b?.name ?? `#${r.team_b_id}`
                        }
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 px-3 pb-3">
                    <a
                      href={`/matches/${r.id}`}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Προβολή
                    </a>
                    {(r.status === "scheduled" || r.status === "postponed") && (
                      <button
                        onClick={() => setPostponingId(r.id)}
                        className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-orange-400/30 bg-orange-700/20 hover:bg-orange-700/35 text-white text-xs transition-colors"
                      >
                        <Clock className="h-3.5 w-3.5" />
                        Αναβολή
                      </button>
                    )}
                    <button
                      onClick={() => setEditingId((prev) => (prev === r.id ? null : r.id))}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/12 bg-zinc-950 hover:bg-zinc-900 text-white text-xs transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      {editingId === r.id ? "Κλείσιμο" : "Επεξεργασία"}
                    </button>
                    <button
                      onClick={() => remove(r.id)}
                      className="min-h-[36px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-red-400/30 bg-red-900/20 hover:bg-red-900/35 text-white text-xs transition-colors ml-auto"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {editingId === r.id && (
                    <div className="px-3 pb-3">
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
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* ── Desktop table view ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full text-sm leading-relaxed text-left text-white/90">
              <thead className="bg-zinc-950/95 text-white/60 sticky top-0 z-10 backdrop-blur border-b border-white/8">
                <tr>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Ημερομηνία</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Αγώνας</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider whitespace-nowrap">Κατάσταση</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-center">Σκορ</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider">Στατιστικά</th>
                  <th className="px-4 py-3 font-medium text-xs uppercase tracking-wider text-right">Ενέργειες</th>
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((r, i) => {
                  const a = one<TeamLite>(r.teamA);
                  const b = one<TeamLite>(r.teamB);
                  const tourName =
                    one(r.tournament)?.name ??
                    (r.tournament_id ? `Tournament #${r.tournament_id}` : "—");
                  const stageTxt = stageLabel(r);

                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        className={[
                          "group border-t border-white/6 transition-colors",
                          i % 2 ? "bg-[#0b0b10]" : "bg-[#0f1015]",
                          "hover:bg-white/4",
                          "relative",
                          r.status === "finished"
                            ? "border-l-2 border-l-emerald-500/60"
                            : r.status === "postponed"
                            ? "border-l-2 border-l-orange-500/60"
                            : "border-l-2 border-l-white/10",
                        ].join(" ")}
                      >
                        {/* Date */}
                        <td className="px-4 py-3 whitespace-nowrap text-white/55 text-xs">
                          {r.match_date ? isoToDTString(r.match_date) : "—"}
                        </td>

                        {/* Match */}
                        <td className="px-4 py-3">
                          {/* Teams row */}
                          <div className="flex items-center gap-2">
                            {a?.logo && (
                              <img src={a.logo} alt={a.name} className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10 shrink-0" />
                            )}
                            <span className={`font-semibold text-sm ${r.winner_team_id && r.winner_team_id === r.team_a_id ? "text-amber-300" : "text-white"}`}>
                              {a?.name ?? `#${r.team_a_id}`}
                            </span>
                            <span className="text-white/25 text-xs">vs</span>
                            <span className={`font-semibold text-sm ${r.winner_team_id && r.winner_team_id === r.team_b_id ? "text-amber-300" : "text-white"}`}>
                              {b?.name ?? `#${r.team_b_id}`}
                            </span>
                            {b?.logo && (
                              <img src={b.logo} alt={b.name} className="h-7 w-7 rounded-full object-contain ring-1 ring-white/10 shrink-0" />
                            )}
                            {r.winner_team_id && (
                              <span title="Έχει νικητή">
                                <Trophy className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                              </span>
                            )}
                          </div>
                          {/* Tour + stage */}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="px-1.5 py-0.5 rounded text-[11px] bg-white/6 border border-white/8 text-white/55">{tourName}</span>
                            {stageTxt && <span className="px-1.5 py-0.5 rounded text-[11px] bg-white/6 border border-white/8 text-white/55">{stageTxt}</span>}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3 whitespace-nowrap">
                          <StatusBadge status={r.status} />
                        </td>

                        {/* Score */}
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-black/60 border border-white/10 font-black text-lg tabular-nums tracking-tight">
                            <span className={r.winner_team_id && r.winner_team_id === r.team_a_id ? "text-amber-400" : "text-white"}>
                              {r.team_a_score ?? "—"}
                            </span>
                            <span className="text-white/25 font-normal text-sm">:</span>
                            <span className={r.winner_team_id && r.winner_team_id === r.team_b_id ? "text-amber-400" : "text-white"}>
                              {r.team_b_score ?? "—"}
                            </span>
                          </span>
                        </td>

                        {/* Stats */}
                        <td className="px-4 py-3">
                          <div className="space-y-1.5">
                            <MatchStatsSummary matchId={r.id} teamAId={r.team_a_id} teamBId={r.team_b_id} />
                            <ScorersList matchId={r.id} teamAId={r.team_a_id} teamBId={r.team_b_id} />
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 justify-end flex-wrap">
                            <a
                              href={`/matches/${r.id}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs transition-colors"
                              title="Προβολή αγώνα"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                            {(r.status === "scheduled" || r.status === "postponed") && (
                              <button
                                onClick={() => setPostponingId(r.id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-orange-400/30 bg-orange-700/15 hover:bg-orange-700/30 text-white text-xs transition-colors"
                                title="Αναβολή"
                              >
                                <Clock className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setEditingId((prev) => (prev === r.id ? null : r.id))}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/12 bg-zinc-950 hover:bg-zinc-800 text-white text-xs transition-colors"
                              title="Επεξεργασία"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              {editingId === r.id ? "Κλείσιμο" : "Επεξ."}
                            </button>
                            <button
                              onClick={() => remove(r.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-400/30 bg-red-900/15 hover:bg-red-900/30 text-white text-xs transition-colors"
                              title="Διαγραφή"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {editingId === r.id && (
                        <tr className="bg-black/70 border-t border-white/6">
                          <td className="px-4 py-3" colSpan={6}>
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

          <Pagination />
        </div>
      )}

      {/* ─── Postpone Dialog ─── */}
      {postponingRow && (
        <PostponeDialog
          match={postponingRow}
          onCancel={() => setPostponingId(null)}
          onSuccess={async () => {
            setPostponingId(null);
            await refreshFromServer();
          }}
        />
      )}
    </section>
  );
}
