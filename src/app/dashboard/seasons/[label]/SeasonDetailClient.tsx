"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, Archive, RefreshCw, Sparkles } from "lucide-react";
import AdjustmentsClient from "@/app/dashboard/geniki-katataxi/AdjustmentsClient";
import type { PointsEvent, TeamSeasonLine } from "@/app/geniki-katataxi/rules";
import { formatInstant } from "@/app/lib/datetime";
import { refreshActiveSeason, resnapshotSeason } from "../actions";

export type StandingSlim = {
  team_id: number;
  rank: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  matches_played: number;
  goals_for: number;
  goals_against: number;
  clean_sheets: number;
  longest_win_streak: number;
  adjustment_points: number;
};

type Team = { id: number; name: string; logo: string | null; deleted: boolean };

function Section({
  title,
  hint,
  children,
  defaultOpen = true,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="rounded-2xl border border-white/10 bg-zinc-950">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          {hint ? <div className="text-xs text-white/50">{hint}</div> : null}
        </div>
        <span className="text-xs text-white/40">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="border-t border-white/10 px-2 pb-3 pt-2 sm:px-4">{children}</div>}
    </section>
  );
}

export default function SeasonDetailClient({
  season,
  stored,
  storedRefreshedAt,
  live,
  teams,
  tournaments,
  recapGeneratedAt,
  statsRows,
  adjustments,
}: {
  season: {
    label: string;
    display_label: string;
    status: "active" | "archived";
    started_on: string | null;
    ended_on: string | null;
  };
  stored: StandingSlim[];
  storedRefreshedAt: string | null;
  /** Fresh compute (null when it failed) — what a re-snapshot would store. */
  live: StandingSlim[] | null;
  teams: Team[];
  tournaments: { id: number; name: string; status: string; winner_team_id: number | null }[];
  recapGeneratedAt: string | null;
  statsRows: number;
  adjustments: { events: PointsEvent[]; lines: TeamSeasonLine[] };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const isActive = season.status === "active";

  const teamById = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);
  const name = (id: number) => teamById.get(id)?.name ?? `Ομάδα #${id}`;

  // Drift = the public snapshot would change on re-snapshot.
  const drift = useMemo(() => {
    if (!live) return false;
    if (live.length !== stored.length) return true;
    const s = new Map(stored.map((r) => [r.team_id, r]));
    return live.some((l) => {
      const c = s.get(l.team_id);
      return !c || c.rank !== l.rank || c.points !== l.points;
    });
  }, [live, stored]);

  const rows = live ?? stored;

  const snapshot = () => {
    setNotice(null);
    startTransition(async () => {
      const res = isActive ? await refreshActiveSeason() : await resnapshotSeason(season.label);
      if (!res.success) setNotice({ ok: false, text: res.error });
      else
        setNotice({
          ok: true,
          text: `Snapshot: ${res.snapshot.standingsRows} ομάδες, ${res.snapshot.statsRows} παίκτες, recap ${res.snapshot.recapStored ? "✓" : "—"}.`,
        });
      router.refresh();
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 pb-24 pt-4 sm:px-4 text-white">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/seasons"
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/15 bg-zinc-900 text-white/80 hover:bg-zinc-800"
          aria-label="Πίσω"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{season.display_label}</h1>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                isActive ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
              }`}
            >
              {isActive ? "ενεργή" : "αρχείο"}
            </span>
          </div>
          <div className="font-mono text-xs text-white/50">
            {season.label}
            {season.started_on ? ` · ${season.started_on}` : ""}
            {season.ended_on ? ` → ${season.ended_on}` : ""}
          </div>
        </div>
        <button
          onClick={snapshot}
          disabled={pending}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm disabled:opacity-50 ${
            drift
              ? "border-amber-500/50 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
              : "border-white/15 bg-zinc-900 text-white/80 hover:bg-zinc-800"
          }`}
        >
          {isActive ? <Sparkles className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
          <span className="hidden sm:inline">{isActive ? "Ανανέωση" : "Επανασύγχρονισμός"}</span>
          {pending && <RefreshCw className="h-4 w-4 animate-spin" />}
        </button>
      </div>

      {notice && (
        <p
          className={`rounded-lg border p-3 text-sm ${
            notice.ok
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
              : "border-red-500/40 bg-red-500/10 text-red-100"
          }`}
        >
          {notice.text}
        </p>
      )}

      {drift && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Ο δημόσιος (αποθηκευμένος) πίνακας διαφέρει από τον τρέχοντα υπολογισμό — π.χ. μετά από
            προσαρμογή πόντων ή διόρθωση αγώνα. Πάτησε «{isActive ? "Ανανέωση" : "Επανασύγχρονισμός"}» για
            να δημοσιευθεί.
          </span>
        </p>
      )}

      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
        {[
          ["Τουρνουά", tournaments.length],
          ["Ομάδες", teams.length],
          ["Κατάταξη (αποθ.)", stored.length],
          ["Παίκτες (αποθ.)", statsRows],
          ["Recap", recapGeneratedAt ? formatInstant(recapGeneratedAt) : "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border border-white/10 bg-zinc-900 p-2">
            <div className="text-white/50">{k}</div>
            <div className="truncate font-mono text-sm text-white">{v}</div>
          </div>
        ))}
      </div>
      {storedRefreshedAt && (
        <p className="text-[11px] text-white/40">Τελευταίο snapshot κατάταξης: {formatInstant(storedRefreshedAt)}</p>
      )}

      <Section
        title="Γενική Κατάταξη"
        hint={live ? "Τρέχων υπολογισμός (ό,τι θα αποθηκευτεί στο επόμενο snapshot)" : "Αποθηκευμένος πίνακας"}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-xs">
            <thead className="text-white/50">
              <tr className="border-b border-white/10 text-left">
                {["#", "Ομάδα", "Πόντοι", "Ν", "Ι", "Η", "Αγ.", "GF", "GA", "CS", "Σερί", "Προσαρμ."].map((h) => (
                  <th key={h} className="px-2 py-2 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.team_id} className="border-b border-white/5">
                  <td className="px-2 py-1.5 font-mono">{r.rank}</td>
                  <td className="px-2 py-1.5">
                    {name(r.team_id)}
                    {teamById.get(r.team_id)?.deleted && (
                      <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60">αποχώρησε</span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 font-mono font-semibold">{r.points}</td>
                  <td className="px-2 py-1.5 font-mono">{r.wins}</td>
                  <td className="px-2 py-1.5 font-mono">{r.draws}</td>
                  <td className="px-2 py-1.5 font-mono">{r.losses}</td>
                  <td className="px-2 py-1.5 font-mono">{r.matches_played}</td>
                  <td className="px-2 py-1.5 font-mono">{r.goals_for}</td>
                  <td className="px-2 py-1.5 font-mono">{r.goals_against}</td>
                  <td className="px-2 py-1.5 font-mono">{r.clean_sheets}</td>
                  <td className="px-2 py-1.5 font-mono">{r.longest_win_streak}</td>
                  <td className={`px-2 py-1.5 font-mono ${r.adjustment_points < 0 ? "text-red-300" : ""}`}>
                    {r.adjustment_points > 0 ? `+${r.adjustment_points}` : r.adjustment_points}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-2 py-6 text-center text-white/40">
                    Καμία ομάδα με πόντους σε αυτή τη σεζόν.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Τουρνουά" hint="Άνοιγμα στον editor για διορθώσεις">
        {tournaments.length === 0 ? (
          <p className="px-2 py-3 text-sm text-white/45">Κανένα τουρνουά.</p>
        ) : (
          <ul className="divide-y divide-white/5">
            {tournaments.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 px-2 py-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm">{t.name}</div>
                  <div className="text-xs text-white/45">
                    #{t.id} · {t.status}
                    {t.winner_team_id ? ` · νικητής: ${name(t.winner_team_id)}` : ""}
                  </div>
                </div>
                <Link
                  href={`/dashboard/tournaments/TournamentCURD/edit/${t.id}`}
                  className="shrink-0 rounded-lg border border-white/15 bg-zinc-900 px-3 py-1.5 text-xs text-white/80 hover:bg-zinc-800"
                >
                  Editor
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={`Ομάδες (${teams.length})`} hint="Ομάδες της σεζόν — οι αποχωρήσεις παραμένουν στο αρχείο" defaultOpen={false}>
        <ul className="grid grid-cols-1 gap-1 sm:grid-cols-2">
          {teams.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-white/5">
              <span className="truncate">
                {t.name}
                {t.deleted && <span className="ml-2 text-[10px] text-white/45">αποχώρησε</span>}
              </span>
              <Link href={`/dashboard/teams`} className="text-xs text-white/50 hover:text-white">
                Ομάδες →
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Προσαρμογές πόντων"
        hint={
          isActive
            ? "Ισχύουν αμέσως στη δημόσια κατάταξη."
            : "Σε αρχειοθετημένη σεζόν: αποθηκεύονται, αλλά ο δημόσιος πίνακας αλλάζει μόνο με Επανασύγχρονισμό."
        }
      >
        <AdjustmentsClient
          teams={teams.filter((t) => !t.deleted).map((t) => ({ id: t.id, name: t.name, logo: t.logo }))}
          seasons={[season.label]}
          events={adjustments.events}
          linesBySeason={{ [season.label]: adjustments.lines }}
          adjustmentsAvailable
        />
      </Section>
    </div>
  );
}
