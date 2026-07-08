// app/dashboard/geniki-katataxi/AdjustmentsClient.tsx
// CLIENT: the Γενική Κατάταξη admin — one row per team with its TOTAL points for the
// selected season, sorted high→low. Tapping a team opens a slide-over drawer with:
//   • its full award log (automatic + manual) for the season,
//   • a form to add manual points to that team,
//   • per-award actions: delete a manual grant, cancel an automatic event
//     (reversible counter-adjustment), or undo a cancellation.
// Built mobile-first: the list is flex rows (no wide table), the drawer is full-width
// on phones and a right-hand panel on desktop.
"use client";

import { Fragment, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  Plus,
  Trash2,
  Ban,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  X,
  Search,
} from "lucide-react";
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_PRESETS,
  type AdjustmentKind,
  type EventKind,
  type PointsEvent,
} from "@/app/geniki-katataxi/rules";
import type { TeamSeasonLine } from "@/app/geniki-katataxi/points";
import { formatMatchDate } from "@/app/lib/datetime";
import { addAdjustment, deleteAdjustment, cancelEvent, uncancelEvent } from "./actions";

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const fmtDate = (iso: string | null | undefined) =>
  iso ? formatMatchDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Human labels for automatic event kinds (adjustment kinds come from ADJUSTMENT_PRESETS).
const EVENT_LABEL: Record<Exclude<EventKind, "adjustment">, string> = {
  participation: "Συμμετοχή",
  qualification: "Πρόκριση",
  title: "Νικητής τουρνουά",
  runner_up: "Διεκδικητής",
  win: "Νίκη",
  draw: "Ισοπαλία",
  loss: "Ήττα",
};

function eventLabel(e: PointsEvent): string {
  if (e.kind === "adjustment") {
    return e.adjustmentKind
      ? ADJUSTMENT_PRESETS[e.adjustmentKind]?.label ?? "Χειροκίνητο"
      : "Χειροκίνητο";
  }
  return EVENT_LABEL[e.kind];
}

type Team = { id: number; name: string; logo: string | null };

type TeamRow = {
  team: Team;
  /** Total season points from the standings line (0 when the team has no line). */
  points: number;
  /** How many award rows this team has this season (automatic + manual). */
  awards: number;
  line: TeamSeasonLine | null;
};

export default function AdjustmentsClient({
  teams,
  seasons,
  events,
  linesBySeason,
  adjustmentsAvailable,
}: {
  teams: Team[];
  seasons: string[];
  events: PointsEvent[];
  linesBySeason: Record<string, TeamSeasonLine[]>;
  adjustmentsAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [season, setSeason] = useState<string>(seasons[0] ?? "");
  const [query, setQuery] = useState("");
  const [openTeamId, setOpenTeamId] = useState<number | null>(null);

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const teamName = (id: number | null) =>
    id == null ? "—" : teamById.get(id)?.name ?? `Ομάδα #${id}`;

  // Events for the selected season, grouped by team.
  const eventsByTeam = useMemo(() => {
    const map = new Map<number, PointsEvent[]>();
    for (const e of events) {
      if (e.season !== season) continue;
      const list = map.get(e.teamId) ?? [];
      list.push(e);
      map.set(e.teamId, list);
    }
    return map;
  }, [events, season]);

  // Per-team season line (carries the total), keyed by team.
  const lineByTeam = useMemo(() => {
    const map = new Map<number, TeamSeasonLine>();
    for (const l of linesBySeason[season] ?? []) map.set(l.teamId, l);
    return map;
  }, [linesBySeason, season]);

  // One row per team. Teams with points/awards come first (points desc); teams with
  // nothing this season are still listed (alphabetical) so points can be added to them.
  const rows = useMemo<TeamRow[]>(() => {
    const built = teams.map((team) => {
      const line = lineByTeam.get(team.id) ?? null;
      return {
        team,
        points: line?.points ?? 0,
        awards: eventsByTeam.get(team.id)?.length ?? 0,
        line,
      };
    });
    built.sort((a, b) => {
      const aHas = a.points !== 0 || a.awards > 0 ? 1 : 0;
      const bHas = b.points !== 0 || b.awards > 0 ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas; // active teams first
      if (b.points !== a.points) return b.points - a.points; // points desc
      return a.team.name.localeCompare(b.team.name, "el");
    });
    return built;
  }, [teams, lineByTeam, eventsByTeam]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.team.name.toLowerCase().includes(q));
  }, [rows, query]);

  const openRow = openTeamId != null ? rows.find((r) => r.team.id === openTeamId) ?? null : null;
  const openEvents = openTeamId != null ? eventsByTeam.get(openTeamId) ?? [] : [];

  const run = (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
    setError(null);
    setBusyKey(key);
    startTransition(async () => {
      const res = await fn();
      setBusyKey(null);
      if (!res.success) setError(res.error ?? "Κάτι πήγε στραβά.");
      else router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-xl font-semibold">Γενική Κατάταξη · Πόντοι ανά ομάδα</h2>
        <p className="mt-1 text-sm text-white/60">
          Μία γραμμή ανά ομάδα με το <b>σύνολο πόντων</b> της σεζόν. Πάτησε μια ομάδα για
          να δεις την ανάλυση των πόντων της και να <b>προσθέσεις ή να ακυρώσεις</b> πόντους.
        </p>
      </header>

      {!adjustmentsAvailable && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Ο πίνακας <code>season_team_adjustments</code> δεν είναι διαθέσιμος. Τρέξε το
          migration <code>migrations/add-season-team-adjustments.sql</code> στο Supabase
          για να ενεργοποιηθούν οι χειροκίνητοι πόντοι και οι ακυρώσεις.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Season + search toolbar ─────────────────────────────────── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-xs text-white/50">Σεζόν</label>
          <select
            className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white"
            value={season}
            onChange={(e) => {
              setSeason(e.target.value);
              setOpenTeamId(null);
            }}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className="w-full rounded-lg border border-white/15 bg-zinc-900 py-2 pl-9 pr-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/50"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Αναζήτηση ομάδας…"
          />
        </div>
      </div>

      {/* ── Team list: one row per team ─────────────────────────────── */}
      <ul className="divide-y divide-white/5 overflow-hidden rounded-xl border border-white/10 bg-zinc-950">
        {filteredRows.length === 0 ? (
          <li className="p-4 text-sm text-white/50">Δεν βρέθηκαν ομάδες.</li>
        ) : (
          filteredRows.map((r) => (
            <li key={r.team.id}>
              <button
                type="button"
                onClick={() => setOpenTeamId(r.team.id)}
                className="flex w-full items-center gap-3 px-3 py-3 text-left transition hover:bg-white/[0.04] sm:px-4"
              >
                {r.team.logo ? (
                  <Image
                    src={r.team.logo}
                    alt={r.team.name}
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-8 w-8 shrink-0 rounded-md border border-white/10 bg-zinc-900" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-white">{r.team.name}</div>
                  <div className="text-xs text-white/45">
                    {r.awards > 0 ? `${r.awards} εγγραφές` : "Χωρίς πόντους"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div
                    className={`font-mono text-lg font-bold tabular-nums ${
                      r.points < 0 ? "text-red-300" : r.points > 0 ? "text-emerald-300" : "text-white/40"
                    }`}
                  >
                    {r.points}
                  </div>
                  <div className="text-[10px] uppercase tracking-wide text-white/35">πόντοι</div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
              </button>
            </li>
          ))
        )}
      </ul>

      {/* ── Slide-over drawer for the open team ─────────────────────── */}
      {openRow && (
        <TeamDrawer
          row={openRow}
          season={season}
          events={openEvents}
          teamName={teamName}
          adjustmentsAvailable={adjustmentsAvailable}
          pending={pending}
          busyKey={busyKey}
          onClose={() => setOpenTeamId(null)}
          run={run}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Drawer
// ─────────────────────────────────────────────────────────────────────────
function TeamDrawer({
  row,
  season,
  events,
  teamName,
  adjustmentsAvailable,
  pending,
  busyKey,
  onClose,
  run,
}: {
  row: TeamRow;
  season: string;
  events: PointsEvent[];
  teamName: (id: number | null) => string;
  adjustmentsAvailable: boolean;
  pending: boolean;
  busyKey: string | null;
  onClose: () => void;
  run: (key: string, fn: () => Promise<{ success: boolean; error?: string }>) => void;
}) {
  const { team } = row;

  // Add-points form state (team + season are fixed by the drawer context).
  const [kind, setKind] = useState<AdjustmentKind>("international");
  const [points, setPoints] = useState<number>(ADJUSTMENT_PRESETS.international.points ?? 0);
  const [reason, setReason] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Close on Escape; lock body scroll while the drawer is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const onKindChange = (k: AdjustmentKind) => {
    setKind(k);
    const preset = ADJUSTMENT_PRESETS[k].points;
    if (preset != null) setPoints(preset);
  };

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const submitGrant = () =>
    run("grant", async () => {
      const res = await addAdjustment({ season, teamId: team.id, kind, points, reason });
      if (res.success) {
        setReason("");
        setShowForm(false);
      }
      return res;
    });

  // Sort: cancelled sink; then |points| desc.
  const sorted = useMemo(
    () =>
      [...events].sort((a, b) => {
        const ac = a.cancelledBy ? 1 : 0;
        const bc = b.cancelledBy ? 1 : 0;
        if (ac !== bc) return ac - bc;
        return Math.abs(b.points) - Math.abs(a.points);
      }),
    [events]
  );

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/50";
  const labelCls = "text-xs text-white/60";

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div className="relative flex h-full w-full flex-col bg-zinc-950 shadow-2xl ring-1 ring-white/10 sm:w-[30rem]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          {team.logo ? (
            <Image
              src={team.logo}
              alt={team.name}
              width={40}
              height={40}
              className="h-10 w-10 rounded-md object-cover"
            />
          ) : (
            <div className="h-10 w-10 rounded-md border border-white/10 bg-zinc-900" />
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">{team.name}</div>
            <div className="text-xs text-white/45">Σεζόν {season}</div>
          </div>
          <div className="text-right">
            <div
              className={`font-mono text-xl font-bold tabular-nums ${
                row.points < 0 ? "text-red-300" : row.points > 0 ? "text-emerald-300" : "text-white/50"
              }`}
            >
              {row.points}
            </div>
            <div className="text-[10px] uppercase tracking-wide text-white/35">σύνολο</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="ml-1 rounded-md p-1.5 text-white/60 hover:bg-white/10 hover:text-white"
            aria-label="Κλείσιμο"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Breakdown chips */}
        {row.line && (
          <div className="grid grid-cols-4 gap-px border-b border-white/10 bg-white/5 text-center sm:grid-cols-8">
            {[
              ["Συμ.", row.line.participations],
              ["Προκ.", row.line.qualifications],
              ["Τίτλ.", row.line.titles],
              ["Τελ.", row.line.runnerUps],
              ["Ν", row.line.wins],
              ["Ι", row.line.draws],
              ["Η", row.line.losses],
              ["Έξτρα", row.line.adjustmentPoints, true],
            ].map(([label, val, isPts], i) => (
              <div key={i} className="bg-zinc-950 py-2">
                <div className="font-mono text-sm font-semibold text-white/85 tabular-nums">
                  {isPts ? (val === 0 ? "—" : signed(val as number)) : (val as number)}
                </div>
                <div className="text-[9px] uppercase tracking-wide text-white/35">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Add-points */}
        <div className="border-b border-white/10 px-4 py-3">
          {!showForm ? (
            <button
              type="button"
              onClick={() => setShowForm(true)}
              disabled={!adjustmentsAvailable}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-600/15 px-4 py-2.5 text-sm font-medium text-emerald-200 hover:bg-emerald-600/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Προσθήκη πόντων
            </button>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className={labelCls}>Λόγος (κανόνας)</label>
                  <select
                    className={inputCls}
                    value={kind}
                    onChange={(e) => onKindChange(e.target.value as AdjustmentKind)}
                  >
                    {ADJUSTMENT_KINDS.map((k) => {
                      const p = ADJUSTMENT_PRESETS[k];
                      return (
                        <option key={k} value={k}>
                          {p.label}
                          {p.points != null ? ` (${signed(p.points)})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Πόντοι</label>
                  <input
                    type="number"
                    className={inputCls}
                    value={points}
                    onChange={(e) => setPoints(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Αιτιολογία</label>
                  <input
                    className={inputCls}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="προαιρετικό"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={submitGrant}
                  disabled={pending || !adjustmentsAvailable}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  {busyKey === "grant" ? "Αποθήκευση…" : "Καταχώρηση"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-white/15 bg-zinc-900 px-4 py-2 text-sm text-white/70 hover:bg-zinc-800"
                >
                  Άκυρο
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Award log */}
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="p-4 text-sm text-white/50">
              Καμία εγγραφή πόντων για αυτή την ομάδα τη σεζόν {season}.
            </p>
          ) : (
            <ul className="divide-y divide-white/5">
              {sorted.map((e, i) => {
                const isManual = e.kind === "adjustment";
                const cancelled = Boolean(e.cancelledBy);
                const rowKey = isManual ? `adj-${e.adjustmentId}` : `evt-${e.sourceKey}`;
                const busy = busyKey === rowKey;
                const details = e.matches ?? [];
                const expandable = details.length > 1;
                const isOpen = expanded.has(rowKey);
                return (
                  <Fragment key={`${rowKey}-${i}`}>
                    <li className={`px-4 py-2.5 ${cancelled ? "opacity-55" : ""}`}>
                      <div className="flex items-start gap-2">
                        {expandable ? (
                          <button
                            type="button"
                            onClick={() => toggle(rowKey)}
                            className="mt-0.5 rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                            aria-expanded={isOpen}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : (
                          <span className="w-[18px]" />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="rounded-md border border-white/15 bg-zinc-900 px-2 py-0.5 text-xs text-white/80">
                              {eventLabel(e)}
                              {e.count > 1 && ` ×${e.count}`}
                            </span>
                            <span
                              className={`rounded-md border px-1.5 py-0.5 text-[10px] ${
                                isManual
                                  ? "border-sky-400/30 bg-sky-500/10 text-sky-200"
                                  : "border-white/10 bg-white/5 text-white/45"
                              }`}
                            >
                              {isManual ? "Χειροκίνητο" : "Αυτόματο"}
                            </span>
                          </div>
                          <div className="mt-1 truncate text-xs text-white/55">
                            {e.label}
                            {details.length === 1 && details[0].opponentId != null && (
                              <span className="text-white/40"> · vs {teamName(details[0].opponentId)}</span>
                            )}
                            <span className="text-white/30"> · {fmtDate(e.date)}</span>
                            {expandable && (
                              <span className="text-white/30"> · {details.length} αγ.</span>
                            )}
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <span
                            className={`font-mono text-sm font-semibold tabular-nums ${
                              cancelled
                                ? "text-white/40 line-through"
                                : e.points < 0
                                  ? "text-red-400"
                                  : "text-emerald-300"
                            }`}
                          >
                            {signed(e.points)}
                          </span>
                          {isManual ? (
                            <button
                              type="button"
                              onClick={() => run(rowKey, () => deleteAdjustment(e.adjustmentId!))}
                              disabled={pending}
                              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-[11px] text-white/70 hover:bg-red-600/20 hover:text-red-300 disabled:opacity-50"
                            >
                              <Trash2 className="h-3 w-3" />
                              {busy ? "…" : "Διαγραφή"}
                            </button>
                          ) : cancelled ? (
                            <button
                              type="button"
                              onClick={() => run(rowKey, () => uncancelEvent(e.cancelledBy!))}
                              disabled={pending}
                              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-[11px] text-white/70 hover:bg-emerald-600/20 hover:text-emerald-300 disabled:opacity-50"
                            >
                              <RotateCcw className="h-3 w-3" />
                              {busy ? "…" : "Επαναφορά"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                run(rowKey, () =>
                                  cancelEvent({
                                    season: e.season,
                                    teamId: e.teamId,
                                    sourceKey: e.sourceKey!,
                                    points: e.points,
                                    note: `Ακύρωση: ${eventLabel(e)} — ${e.label}`,
                                  })
                                )
                              }
                              disabled={pending || !adjustmentsAvailable}
                              className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-[11px] text-white/70 hover:bg-red-600/20 hover:text-red-300 disabled:opacity-50"
                            >
                              <Ban className="h-3 w-3" />
                              {busy ? "…" : "Ακύρωση"}
                            </button>
                          )}
                        </div>
                      </div>

                      {expandable && isOpen && (
                        <ul className="mt-2 space-y-1 border-l border-white/10 pl-4">
                          {details.map((m, mi) => (
                            <li
                              key={mi}
                              className="flex items-center justify-between text-[11px] text-white/55"
                            >
                              <span>vs {teamName(m.opponentId)}</span>
                              <span className="font-mono text-white/45">
                                {m.goalsFor != null && m.goalsAgainst != null
                                  ? `${m.goalsFor}–${m.goalsAgainst}`
                                  : ""}
                              </span>
                              <span className="text-white/40">{fmtDate(m.date)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  </Fragment>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
