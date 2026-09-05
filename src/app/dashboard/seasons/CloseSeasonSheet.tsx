"use client";

// "Κλείσιμο σεζόν": preflight → fix what is pending → next-season form →
// confirm. The action runs the final snapshot, then flips the pointer
// (contract §4). Blockers stop the close unless the admin ticks the override.
//
// The pending lists let the admin resolve a match without leaving the sheet.
// Each control calls the SAME writer the rest of the admin uses:
//   Ολοκλήρωση  → PATCH /api/matches/[id]  (scores → winner rules, progression,
//                 standings refresh, revalidation)
//   Κατακύρωση  → awardForfeitWinAction     (3–0, finished, no player stats)
//   Αναβολή     → POST /api/matches/[id]/postpone (no new date → status
//                 postponed, date cleared; a public announcement is posted)
//   Ολοκληρωμένο → completeTournament       (status only)
// After every fix the preflight is re-run so blockers and counts are current.

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import BottomSheet from "./BottomSheet";
import {
  closeSeason,
  completeTournament,
  preflightCloseSeason,
  type ClosePreflight,
  type PreflightMatch,
  type PreflightTournament,
} from "./actions";
import { awardForfeitWinAction } from "@/app/dashboard/tournaments/TournamentCURD/preview/actions";
import { displayLabelForSeason } from "@/app/geniki-katataxi/rules";
import { formatMatchDateTime } from "@/app/lib/datetime";

const editorHref = (tournamentId: number | null) =>
  tournamentId == null ? null : `/dashboard/tournaments/TournamentCURD/edit/${tournamentId}`;

const isDigits = (s: string) => /^\d+$/.test(s.trim());

const smallBtn =
  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const numInput =
  "w-12 rounded-md border border-white/15 bg-zinc-950 px-1.5 py-1 text-center font-mono text-sm text-white";

// ─── One unfinished match ───────────────────────────────────────────────────

function PendingMatchRow({
  m,
  busy,
  onFinish,
  onForfeit,
  onPostpone,
}: {
  m: PreflightMatch;
  busy: boolean;
  onFinish: (m: PreflightMatch, s: { a: number; b: number; pa?: number; pb?: number }) => Promise<string | null>;
  onForfeit: (m: PreflightMatch, side: "A" | "B") => Promise<string | null>;
  onPostpone: (m: PreflightMatch) => Promise<string | null>;
}) {
  const [mode, setMode] = useState<"idle" | "finish" | "forfeit">("idle");
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [pa, setPa] = useState("");
  const [pb, setPb] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const hasTeams = m.team_a_id != null && m.team_b_id != null;
  const ko = m.stage_kind === "knockout";
  const pensTyped = pa.trim() !== "" || pb.trim() !== "";
  const canSave = isDigits(a) && isDigits(b) && (!pensTyped || (isDigits(pa) && isDigits(pb)));
  const editor = editorHref(m.tournament_id);

  const run = async (fn: () => Promise<string | null>) => {
    setErr(null);
    const e = await fn();
    if (e) setErr(e);
    else setMode("idle");
  };

  return (
    <li className="space-y-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-white/50">
            <span
              className={`rounded-full px-1.5 py-0.5 font-semibold uppercase tracking-wide ${
                m.past ? "bg-red-500/20 text-red-200" : "bg-amber-500/20 text-amber-200"
              }`}
            >
              {m.past ? "παρελθόν" : m.match_date ? "μελλοντικός" : "χωρίς ημερομηνία"}
            </span>
            <span className="truncate">{m.tournament_name}</span>
            {m.match_date && <span>· {formatMatchDateTime(m.match_date, { day: "2-digit", month: "short", year: "numeric" })}</span>}
            {ko && m.leg != null && <span>· leg {m.leg}</span>}
            {m.status === "postponed" && <span className="text-amber-200/80">· αναβλήθηκε</span>}
          </div>
          <div className="mt-0.5 truncate text-sm text-white">
            {m.team_a_name} <span className="text-white/40">–</span> {m.team_b_name}
          </div>
        </div>
        {editor && (
          <Link
            href={editor}
            target="_blank"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-white/15 bg-zinc-950 text-white/60 hover:text-white"
            aria-label="Άνοιγμα στον editor"
            title="Άνοιγμα στον editor"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {mode === "idle" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            disabled={busy || !hasTeams}
            onClick={() => setMode("finish")}
            className={`${smallBtn} border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20`}
          >
            Ολοκλήρωση με σκορ
          </button>
          <button
            disabled={busy || !hasTeams}
            onClick={() => setMode("forfeit")}
            className={`${smallBtn} border-white/15 bg-zinc-950 text-white/80 hover:bg-zinc-800`}
          >
            Κατακύρωση 3–0
          </button>
          <button
            disabled={busy || !m.match_date}
            onClick={() => {
              if (
                !window.confirm(
                  `Αναβολή του ${m.team_a_name} – ${m.team_b_name} χωρίς νέα ημερομηνία; Θα δημοσιευθεί ανακοίνωση αναβολής και ο αγώνας θα πάψει να μπλοκάρει το κλείσιμο.`,
                )
              )
                return;
              void run(() => onPostpone(m));
            }}
            className={`${smallBtn} border-white/15 bg-zinc-950 text-white/80 hover:bg-zinc-800`}
          >
            Αναβολή
          </button>
          {!hasTeams && <span className="text-[11px] text-white/45">Χωρίς ομάδες — όρισέ τες στον editor.</span>}
        </div>
      )}

      {mode === "finish" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-white/60">Σκορ</span>
          <input value={a} onChange={(e) => setA(e.target.value)} inputMode="numeric" placeholder="0" className={numInput} aria-label={`Γκολ ${m.team_a_name}`} />
          <span className="text-white/40">–</span>
          <input value={b} onChange={(e) => setB(e.target.value)} inputMode="numeric" placeholder="0" className={numInput} aria-label={`Γκολ ${m.team_b_name}`} />
          {ko && (
            <>
              <span className="ml-1 text-xs text-white/60">πέν.</span>
              <input value={pa} onChange={(e) => setPa(e.target.value)} inputMode="numeric" placeholder="–" className={numInput} aria-label={`Πέναλτι ${m.team_a_name}`} />
              <span className="text-white/40">–</span>
              <input value={pb} onChange={(e) => setPb(e.target.value)} inputMode="numeric" placeholder="–" className={numInput} aria-label={`Πέναλτι ${m.team_b_name}`} />
            </>
          )}
          <button
            disabled={busy || !canSave}
            onClick={() =>
              void run(() =>
                onFinish(m, {
                  a: Number(a),
                  b: Number(b),
                  ...(pensTyped ? { pa: Number(pa), pb: Number(pb) } : {}),
                }),
              )
            }
            className={`${smallBtn} border-emerald-500/50 bg-emerald-600 text-white hover:bg-emerald-500`}
          >
            {busy ? "…" : "Αποθήκευση"}
          </button>
          <button disabled={busy} onClick={() => setMode("idle")} className={`${smallBtn} border-white/15 bg-zinc-950 text-white/70`}>
            Άκυρο
          </button>
        </div>
      )}

      {mode === "forfeit" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-white/60">Νικητής</span>
          {(["A", "B"] as const).map((side) => {
            const name = side === "A" ? m.team_a_name : m.team_b_name;
            return (
              <button
                key={side}
                disabled={busy}
                onClick={() => {
                  if (
                    !window.confirm(
                      `Κατακύρωση ${side === "A" ? "3–0" : "0–3"} υπέρ ${name}; Ο αγώνας σημαίνεται ολοκληρωμένος, τρέχει η πρόκριση, δεν καταγράφονται στατιστικά παικτών.`,
                    )
                  )
                    return;
                  void run(() => onForfeit(m, side));
                }}
                className={`${smallBtn} border-white/15 bg-zinc-950 text-white/85 hover:bg-zinc-800`}
              >
                {side === "A" ? "3–0" : "0–3"} {name}
              </button>
            );
          })}
          <button disabled={busy} onClick={() => setMode("idle")} className={`${smallBtn} border-white/15 bg-zinc-950 text-white/70`}>
            Άκυρο
          </button>
        </div>
      )}

      {err && <p className="text-xs text-red-300">{err}</p>}
    </li>
  );
}

// ─── One open tournament ────────────────────────────────────────────────────

function OpenTournamentRow({
  t,
  busy,
  onComplete,
}: {
  t: PreflightTournament;
  busy: boolean;
  onComplete: (t: PreflightTournament) => Promise<string | null>;
}) {
  const [err, setErr] = useState<string | null>(null);
  const allPlayed = t.matches > 0 && t.finished === t.matches;
  return (
    <li className="space-y-1.5 px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm text-white">{t.name}</div>
          <div className="text-[11px] text-white/50">
            #{t.id} · <span className="font-mono">{t.status}</span> · αγώνες {t.finished}/{t.matches}
            {t.winner_name ? ` · νικητής: ${t.winner_name}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            disabled={busy}
            onClick={() => {
              if (
                !allPlayed &&
                !window.confirm(
                  `Το ${t.name} έχει ${t.matches - t.finished} αγώνες που δεν έχουν ολοκληρωθεί. Να σημανθεί ολοκληρωμένο παρόλα αυτά; (Η κατάσταση δεν επηρεάζει πόντους ή στατιστικά.)`,
                )
              )
                return;
              setErr(null);
              void onComplete(t).then((e) => setErr(e));
            }}
            className={`${smallBtn} border-emerald-500/40 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20`}
          >
            {busy ? "…" : "Ολοκληρωμένο"}
          </button>
          <Link
            href={editorHref(t.id)!}
            target="_blank"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-zinc-950 text-white/60 hover:text-white"
            aria-label="Άνοιγμα στον editor"
            title="Άνοιγμα στον editor"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
    </li>
  );
}

// ─── The sheet ──────────────────────────────────────────────────────────────

export default function CloseSeasonSheet({
  label,
  display,
  onClose,
  onDone,
}: {
  label: string;
  display: string;
  onClose: () => void;
  onDone: (nextLabel: string) => void;
}) {
  const [pre, setPre] = useState<ClosePreflight | null>(null);
  const [preError, setPreError] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [nextLabel, setNextLabel] = useState("");
  const [nextDisplay, setNextDisplay] = useState("");
  const [startedOn, setStartedOn] = useState("");
  const [force, setForce] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const formSeeded = useRef(false);

  // Loads (and re-loads after a fix) the preflight. The next-season form is
  // seeded once so a reload never overwrites what the admin typed.
  const loadPreflight = useCallback(async () => {
    setReloading(true);
    try {
      const res = await preflightCloseSeason(label);
      if (!res.success) {
        setPreError(res.error);
        return;
      }
      setPreError(null);
      setPre(res.preflight);
      if (!formSeeded.current) {
        formSeeded.current = true;
        setNextLabel(res.preflight.suggestedNext.label);
        setNextDisplay(res.preflight.suggestedNext.display_label);
        setStartedOn(res.preflight.suggestedNext.started_on);
      }
    } finally {
      setReloading(false);
    }
  }, [label]);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  // ── fixes: each returns an error string or null, and reloads on success ──
  const withBusy = async (key: string, fn: () => Promise<string | null>) => {
    setBusyKey(key);
    try {
      const e = await fn();
      if (!e) await loadPreflight();
      return e;
    } catch (err) {
      return err instanceof Error ? err.message : String(err);
    } finally {
      setBusyKey(null);
    }
  };

  const finishMatch = (m: PreflightMatch, s: { a: number; b: number; pa?: number; pb?: number }) =>
    withBusy(`m:${m.id}`, async () => {
      const body: Record<string, unknown> = { status: "finished", team_a_score: s.a, team_b_score: s.b };
      if (s.pa != null && s.pb != null) {
        body.penalty_a = s.pa;
        body.penalty_b = s.pb;
      }
      const res = await fetch(`/api/matches/${m.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => null);
      return res.ok ? null : (j?.error as string | undefined) ?? `HTTP ${res.status}`;
    });

  const forfeitMatch = (m: PreflightMatch, side: "A" | "B") =>
    withBusy(`m:${m.id}`, async () => {
      const r = await awardForfeitWinAction(m.id, side);
      return r.success ? null : r.error ?? "Σφάλμα κατακύρωσης";
    });

  const postponeMatch = (m: PreflightMatch) =>
    withBusy(`m:${m.id}`, async () => {
      const res = await fetch(`/api/matches/${m.id}/postpone`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const j = await res.json().catch(() => null);
      return res.ok ? null : (j?.error as string | undefined) ?? `HTTP ${res.status}`;
    });

  const completeT = (t: PreflightTournament) =>
    withBusy(`t:${t.id}`, async () => {
      const r = await completeTournament({ tournamentId: t.id, seasonLabel: label });
      return r.success ? null : r.error;
    });

  // ── close ──
  const blocked = (pre?.blockers.length ?? 0) > 0 && !force;
  const labelOk = /^\S+$/.test(nextLabel) && nextLabel !== label;
  const canSubmit = !!pre && !blocked && labelOk && confirmText.trim() === label && !pending && busyKey == null;

  const submit = () => {
    setResult(null);
    startTransition(async () => {
      const res = await closeSeason({
        currentLabel: label,
        nextLabel: nextLabel.trim(),
        nextDisplayLabel: nextDisplay.trim() || displayLabelForSeason(nextLabel.trim()),
        nextStartedOn: startedOn || null,
        force,
      });
      if (!res.success) {
        setResult({ ok: false, message: res.error });
        return;
      }
      setResult({
        ok: true,
        message: `Η σεζόν ${display} αρχειοθετήθηκε (${res.snapshot.standingsRows} ομάδες, ${res.snapshot.statsRows} παίκτες, recap ${res.snapshot.recapStored ? "✓" : "—"}). Ενεργή σεζόν: ${res.next}.`,
      });
      onDone(res.next);
    });
  };

  const showWork = !!pre && !result?.ok;

  return (
    <BottomSheet title="Κλείσιμο σεζόν" subtitle={`${display} · ${label}`} onClose={onClose} wide>
      <div className="space-y-4 px-4 py-4 text-sm text-white">
        {preError && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-red-200">{preError}</p>
        )}
        {!pre && !preError && (
          <p className="flex items-center gap-2 text-white/60">
            <Loader2 className="h-4 w-4 animate-spin" /> Έλεγχος σεζόν…
          </p>
        )}

        {showWork && (
          <>
            <section className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
              {[
                ["Τουρνουά", pre.info.tournaments],
                ["Ομάδες", pre.info.teams],
                ["Αγώνες", `${pre.info.finishedMatches}/${pre.info.matches}`],
                ["Στατιστικά παικτών", pre.info.statsRows],
                ["Γραμμές κατάταξης", pre.info.standingsRows],
                ["Recap", pre.info.recapGeneratedAt ? "✓" : "—"],
              ].map(([k, v]) => (
                <div key={String(k)} className="rounded-lg border border-white/10 bg-zinc-900 p-2">
                  <div className="text-white/50">{k}</div>
                  <div className="font-mono text-base text-white">{v}</div>
                </div>
              ))}
            </section>

            {pre.blockers.length > 0 && (
              <section className="space-y-1 rounded-lg border border-red-500/40 bg-red-500/10 p-3">
                <div className="flex items-center gap-2 font-semibold text-red-200">
                  <Ban className="h-4 w-4" /> Εμπόδια
                </div>
                {pre.blockers.map((b) => (
                  <p key={b} className="text-red-100/90">
                    {b}
                  </p>
                ))}
                <label className="mt-2 flex items-start gap-2 text-red-100">
                  <input
                    type="checkbox"
                    checked={force}
                    onChange={(e) => setForce(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>Παράβλεψη — κλείσε τη σεζόν παρόλα αυτά.</span>
                </label>
              </section>
            )}

            {pre.warnings.length > 0 && (
              <section className="space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <div className="flex items-center gap-2 font-semibold text-amber-200">
                  <AlertTriangle className="h-4 w-4" /> Προσοχή
                </div>
                {pre.warnings.map((w) => (
                  <p key={w} className="text-amber-100/90">
                    {w}
                  </p>
                ))}
              </section>
            )}

            {(pre.unfinishedMatches.length > 0 || pre.openTournaments.length > 0) && (
              <div className="flex items-center justify-between text-xs text-white/50">
                <span>Διόρθωσε εδώ ό,τι εκκρεμεί· ο έλεγχος ξανατρέχει μετά από κάθε αλλαγή.</span>
                <button
                  onClick={() => void loadPreflight()}
                  disabled={reloading || busyKey != null}
                  className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-zinc-900 px-2 py-1 text-white/70 hover:bg-zinc-800 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${reloading ? "animate-spin" : ""}`} /> Επανέλεγχος
                </button>
              </div>
            )}

            {pre.unfinishedMatches.length > 0 && (
              <section className="rounded-lg border border-white/10 bg-zinc-900">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="font-semibold">
                    Αγώνες σε εκκρεμότητα <span className="font-normal text-white/50">({pre.unfinishedMatches.length})</span>
                  </div>
                  <div className="text-[11px] text-white/45">
                    {pre.info.unfinishedPast} μπλοκάρουν · {pre.info.unfinishedFuture} προειδοποίηση
                  </div>
                </div>
                <ul className="max-h-80 divide-y divide-white/5 overflow-y-auto border-t border-white/10">
                  {pre.unfinishedMatches.map((m) => (
                    <PendingMatchRow
                      key={m.id}
                      m={m}
                      busy={busyKey != null}
                      onFinish={finishMatch}
                      onForfeit={forfeitMatch}
                      onPostpone={postponeMatch}
                    />
                  ))}
                </ul>
              </section>
            )}

            {pre.openTournaments.length > 0 && (
              <section className="rounded-lg border border-white/10 bg-zinc-900">
                <div className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="font-semibold">
                    Τουρνουά σε εξέλιξη <span className="font-normal text-white/50">({pre.openTournaments.length})</span>
                  </div>
                  <div className="text-[11px] text-white/45">κατάσταση μόνο · δεν αλλάζει πόντους</div>
                </div>
                <ul className="max-h-60 divide-y divide-white/5 overflow-y-auto border-t border-white/10">
                  {pre.openTournaments.map((t) => (
                    <OpenTournamentRow key={t.id} t={t} busy={busyKey != null} onComplete={completeT} />
                  ))}
                </ul>
              </section>
            )}

            <section className="space-y-3 rounded-lg border border-white/10 bg-zinc-900 p-3">
              <div className="font-semibold">Νέα ενεργή σεζόν</div>
              <label className="block text-xs text-white/60">
                Κλειδί (π.χ. 2026-2027)
                <input
                  value={nextLabel}
                  onChange={(e) => {
                    setNextLabel(e.target.value);
                    setNextDisplay(displayLabelForSeason(e.target.value.trim()));
                  }}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Εμφάνιση (π.χ. 2026/27)
                <input
                  value={nextDisplay}
                  onChange={(e) => setNextDisplay(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>
              <label className="block text-xs text-white/60">
                Έναρξη
                <input
                  type="date"
                  value={startedOn}
                  onChange={(e) => setStartedOn(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 text-sm text-white"
                />
              </label>
            </section>

            <section className="space-y-2 rounded-lg border border-white/10 bg-zinc-900 p-3 text-xs text-white/70">
              <p>
                Τι θα γίνει: τελικό snapshot (στατιστικά παικτών, Γενική Κατάταξη, recap) της{" "}
                <b className="text-white">{display}</b>, μετά η {display} γίνεται «αρχείο» και η{" "}
                <b className="text-white">{nextDisplay || nextLabel || "…"}</b> ενεργή. Κανένας αγώνας,
                ομάδα ή στατιστικό δεν διαγράφεται. Οι ζωντανές σελίδες θα δείχνουν την νέα (άδεια) σεζόν
                μέχρι να δημιουργηθούν ομάδες και τουρνουά.
              </p>
              <label className="block text-white/60">
                Γράψε <span className="font-mono text-white">{label}</span> για επιβεβαίωση
                <input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-2 font-mono text-sm text-white"
                />
              </label>
            </section>
          </>
        )}

        {result && (
          <p
            className={`flex items-start gap-2 rounded-lg border p-3 ${
              result.ok
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                : "border-red-500/40 bg-red-500/10 text-red-100"
            }`}
          >
            {result.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Ban className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{result.message}</span>
          </p>
        )}
      </div>

      <div className="flex gap-2 border-t border-white/10 px-3 pb-3 pt-2">
        <button
          onClick={onClose}
          className="flex-1 rounded-lg border border-white/15 bg-zinc-900 py-2.5 text-sm text-white/80 transition-colors hover:bg-zinc-800"
        >
          {result?.ok ? "Κλείσιμο" : "Ακύρωση"}
        </button>
        {!result?.ok && (
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="flex-1 rounded-lg border border-red-500/50 bg-red-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "Κλείσιμο…" : "Κλείσιμο σεζόν"}
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
