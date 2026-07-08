// app/dashboard/geniki-katataxi/AdjustmentsClient.tsx
// CLIENT: the full Αναλυτικό μητρώο πόντων for the dashboard — every points award
// (automatic + manual) with its source, filterable by season and reason, plus:
//   • grant new manual points for any rule,
//   • delete a manual grant,
//   • cancel an automatic event (writes a reversible counter-adjustment),
//   • undo a cancellation.
"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Ban, RotateCcw, ChevronRight, ChevronDown } from "lucide-react";
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_PRESETS,
  type AdjustmentKind,
  type EventKind,
  type PointsEvent,
} from "@/app/geniki-katataxi/rules";
import { formatMatchDate } from "@/app/lib/datetime";
import { addAdjustment, deleteAdjustment, cancelEvent, uncancelEvent } from "./actions";

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const fmtDate = (iso: string | null | undefined) =>
  iso ? formatMatchDate(iso, { day: "2-digit", month: "short", year: "numeric" }) : "—";

// Human labels for the automatic event kinds (adjustment kinds come from ADJUSTMENT_PRESETS).
const EVENT_LABEL: Record<Exclude<EventKind, "adjustment">, string> = {
  participation: "Συμμετοχή",
  qualification: "Πρόκριση",
  title: "Νικητής τουρνουά",
  runner_up: "Διεκδικητής",
  win: "Νίκη",
  draw: "Ισοπαλία",
  loss: "Ήττα",
};

type Filter = "all" | "manual" | EventKind;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "Όλα" },
  { key: "participation", label: "Συμμετοχές" },
  { key: "qualification", label: "Προκρίσεις" },
  { key: "title", label: "Τίτλοι" },
  { key: "runner_up", label: "Τελικοί" },
  { key: "win", label: "Νίκες" },
  { key: "draw", label: "Ισοπαλίες" },
  { key: "loss", label: "Ήττες" },
  { key: "manual", label: "Χειροκίνητα" },
];

function eventLabel(e: PointsEvent): string {
  if (e.kind === "adjustment") {
    return e.adjustmentKind
      ? ADJUSTMENT_PRESETS[e.adjustmentKind]?.label ?? "Χειροκίνητο"
      : "Χειροκίνητο";
  }
  return EVENT_LABEL[e.kind];
}

export default function AdjustmentsClient({
  teams,
  seasons,
  events,
  adjustmentsAvailable,
}: {
  teams: { id: number; name: string }[];
  seasons: string[];
  events: PointsEvent[];
  adjustmentsAvailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  // Grant form state
  const [gSeason, setGSeason] = useState(seasons[0] ?? "");
  const [teamId, setTeamId] = useState<number>(teams[0]?.id ?? 0);
  const [kind, setKind] = useState<AdjustmentKind>("international");
  const [points, setPoints] = useState<number>(ADJUSTMENT_PRESETS.international.points ?? 0);
  const [reason, setReason] = useState("");

  // Log filters
  const [season, setSeason] = useState<string>(seasons[0] ?? "");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const teamName = useMemo(() => new Map(teams.map((t) => [t.id, t.name])), [teams]);
  const oppName = (id: number | null) =>
    id == null ? "—" : teamName.get(id) ?? `Ομάδα #${id}`;

  const seasonEvents = useMemo(
    () => events.filter((e) => e.season === season),
    [events, season]
  );

  const filtered = useMemo(() => {
    let list = seasonEvents;
    if (filter === "manual") list = list.filter((e) => e.kind === "adjustment");
    else if (filter !== "all") list = list.filter((e) => e.kind === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((e) => {
        const name = (teamName.get(e.teamId) ?? "").toLowerCase();
        return name.includes(q) || e.label.toLowerCase().includes(q);
      });
    }
    // Cancelled events sink to the bottom; otherwise by |points| desc, then team.
    return [...list].sort((a, b) => {
      const ac = a.cancelledBy ? 1 : 0;
      const bc = b.cancelledBy ? 1 : 0;
      if (ac !== bc) return ac - bc;
      return (
        Math.abs(b.points) - Math.abs(a.points) ||
        (teamName.get(a.teamId) ?? "").localeCompare(teamName.get(b.teamId) ?? "", "el")
      );
    });
  }, [seasonEvents, filter, query, teamName]);

  const netTotal = useMemo(
    () => filtered.reduce((s, e) => s + (e.cancelledBy ? 0 : e.points), 0),
    [filtered]
  );

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

  const onKindChange = (k: AdjustmentKind) => {
    setKind(k);
    const preset = ADJUSTMENT_PRESETS[k].points;
    if (preset != null) setPoints(preset);
  };

  const submitGrant = () =>
    run("grant", async () => {
      const res = await addAdjustment({ season: gSeason, teamId, kind, points, reason });
      if (res.success) setReason("");
      return res;
    });

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/50";
  const labelCls = "text-xs text-white/60";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Γενική Κατάταξη · Αναλυτικό μητρώο πόντων</h2>
        <p className="mt-1 text-sm text-white/60">
          Κάθε πόντος κάθε ομάδας, με την πηγή του. Οι <b>αυτόματοι</b> πόντοι
          (συμμετοχή, πρόκριση, τίτλος, Ν/Ι/Η) προκύπτουν από τα τουρνουά και τους
          αγώνες· μπορείς να τους <b>ακυρώσεις</b> (γράφεται αντίθετη εγγραφή, αναστρέψιμο).
          Οι <b>χειροκίνητοι</b> πόντοι διαγράφονται κανονικά.
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

      {/* ── Grant form ─────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-zinc-950 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white/80">Νέα χειροκίνητη καταχώρηση</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className={labelCls}>Σεζόν</label>
            <input
              className={inputCls}
              list="gk-seasons"
              value={gSeason}
              onChange={(e) => setGSeason(e.target.value)}
              placeholder="π.χ. 2024/25"
            />
            <datalist id="gk-seasons">
              {seasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <p className="text-[11px] text-white/40">
              Μορφή «2024/25». Για παλιότερες σεζόν γράψε ελεύθερα τη σεζόν (η σεζόν
              ξεκινά 30 Σεπ).
            </p>
          </div>
          <div className="space-y-1">
            <label className={labelCls}>Ομάδα</label>
            <select
              className={inputCls}
              value={teamId}
              onChange={(e) => setTeamId(Number(e.target.value))}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
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
            <label className={labelCls}>Αιτιολογία (προαιρετική)</label>
            <input
              className={inputCls}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="π.χ. Συμμετοχή σε ευρωπαϊκή διοργάνωση"
            />
          </div>
        </div>
        <div className="mt-4">
          <button
            onClick={submitGrant}
            disabled={pending || !adjustmentsAvailable}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {busyKey === "grant" ? "Αποθήκευση…" : "Καταχώρηση"}
          </button>
        </div>
      </section>

      {/* ── Full log ───────────────────────────────────────────────── */}
      <section className="rounded-xl border border-white/10 bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h3 className="text-sm font-semibold text-white/80">
              Μητρώο πόντων ({filtered.length}) · Καθαρό σύνολο:{" "}
              <span className={netTotal < 0 ? "text-red-300" : "text-emerald-300"}>
                {netTotal}
              </span>
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-white"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              >
                {seasons.map((s) => (
                  <option key={s} value={s}>
                    Σεζόν {s}
                  </option>
                ))}
              </select>
              <input
                className="rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1 text-xs text-white placeholder:text-white/40"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Αναζήτηση ομάδας/πηγής…"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                  filter === f.key
                    ? "border-emerald-400/50 bg-emerald-600/20 text-white"
                    : "border-white/15 bg-zinc-900 text-white/70 hover:bg-zinc-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-white/50">Δεν υπάρχουν εγγραφές για αυτά τα φίλτρα.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-xs text-white/60">
                <tr>
                  <th className="w-8 px-2 py-2" />
                  <th className="px-4 py-2">Ομάδα</th>
                  <th className="px-4 py-2">Λόγος</th>
                  <th className="px-4 py-2">Πηγή</th>
                  <th className="whitespace-nowrap px-4 py-2">Ημ/νία</th>
                  <th className="px-4 py-2 text-center">Τύπος</th>
                  <th className="px-4 py-2 text-right">Πόντοι</th>
                  <th className="px-4 py-2 text-right">Ενέργεια</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const isManual = e.kind === "adjustment";
                  const cancelled = Boolean(e.cancelledBy);
                  const rowKey = isManual
                    ? `adj-${e.adjustmentId}`
                    : `evt-${e.sourceKey}`;
                  const busy = busyKey === rowKey;
                  const details = e.matches ?? [];
                  // Expandable only when there are per-match rows worth showing
                  // (a single match already fits the main row).
                  const expandable = details.length > 1;
                  const isOpen = expanded.has(rowKey);
                  return (
                    <Fragment key={rowKey}>
                    <tr
                      className={`border-t border-white/5 odd:bg-zinc-950 even:bg-zinc-900/40 ${
                        cancelled ? "opacity-55" : ""
                      }`}
                    >
                      <td className="px-2 py-2 text-center">
                        {expandable ? (
                          <button
                            onClick={() => toggle(rowKey)}
                            className="rounded p-0.5 text-white/50 hover:bg-white/10 hover:text-white"
                            title={isOpen ? "Σύμπτυξη" : "Ανάλυση αγώνων"}
                            aria-expanded={isOpen}
                          >
                            {isOpen ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-white">
                        {teamName.get(e.teamId) ?? `Ομάδα #${e.teamId}`}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2">
                        <span className="rounded-md border border-white/15 bg-zinc-900 px-2 py-0.5 text-xs text-white/80">
                          {eventLabel(e)}
                          {e.count > 1 && ` ×${e.count}`}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-white/60">
                        {e.label}
                        {/* single-match events name the opponent inline */}
                        {details.length === 1 && details[0].opponentId != null && (
                          <span className="text-white/45"> · vs {oppName(details[0].opponentId)}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-white/60">
                        {fmtDate(e.date)}
                        {expandable && (
                          <span className="ml-1 text-white/35">
                            ({details.length} αγ.)
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-center">
                        {isManual ? (
                          <span className="rounded-md border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 text-xs text-sky-200">
                            Χειροκίνητο
                          </span>
                        ) : (
                          <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/50">
                            Αυτόματο
                          </span>
                        )}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold tabular-nums ${
                          cancelled
                            ? "text-white/40 line-through"
                            : e.points < 0
                              ? "text-red-400"
                              : "text-emerald-300"
                        }`}
                      >
                        {signed(e.points)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-right">
                        {isManual ? (
                          <button
                            onClick={() =>
                              run(rowKey, () => deleteAdjustment(e.adjustmentId!))
                            }
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white/70 hover:bg-red-600/20 hover:text-red-300 disabled:opacity-50"
                            title="Διαγραφή χειροκίνητης εγγραφής"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            {busy ? "…" : "Διαγραφή"}
                          </button>
                        ) : cancelled ? (
                          <button
                            onClick={() => run(rowKey, () => uncancelEvent(e.cancelledBy!))}
                            disabled={pending}
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white/70 hover:bg-emerald-600/20 hover:text-emerald-300 disabled:opacity-50"
                            title="Αναίρεση ακύρωσης"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            {busy ? "…" : "Επαναφορά"}
                          </button>
                        ) : (
                          <button
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
                            className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-xs text-white/70 hover:bg-red-600/20 hover:text-red-300 disabled:opacity-50"
                            title="Ακύρωση αυτόματου πόντου (αναστρέψιμο)"
                          >
                            <Ban className="h-3.5 w-3.5" />
                            {busy ? "…" : "Ακύρωση"}
                          </button>
                        )}
                      </td>
                    </tr>

                    {expandable && isOpen &&
                      details.map((m, i) => (
                        <tr
                          key={`${rowKey}-m${i}`}
                          className="border-t border-white/5 bg-black/40 text-xs"
                        >
                          <td />
                          <td className="px-4 py-1.5 text-white/40">↳</td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-white/70">
                            vs {oppName(m.opponentId)}
                          </td>
                          <td className="px-4 py-1.5 text-white/45">
                            {m.goalsFor != null && m.goalsAgainst != null
                              ? `${m.goalsFor}–${m.goalsAgainst}`
                              : ""}
                          </td>
                          <td className="whitespace-nowrap px-4 py-1.5 text-white/60">
                            {fmtDate(m.date)}
                          </td>
                          <td />
                          <td />
                          <td />
                        </tr>
                      ))}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
