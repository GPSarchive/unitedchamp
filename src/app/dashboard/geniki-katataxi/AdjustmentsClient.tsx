// app/dashboard/geniki-katataxi/AdjustmentsClient.tsx
// CLIENT: form to grant any manual points of the Γενική Κατάταξη point system,
// plus the log of existing grants with per-reason filter buttons and delete.
"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import {
  ADJUSTMENT_KINDS,
  ADJUSTMENT_PRESETS,
  type AdjustmentKind,
} from "@/app/geniki-katataxi/rules";
import { addAdjustment, deleteAdjustment } from "./actions";

export type AdjustmentRow = {
  id: number;
  season: string;
  team_id: number;
  kind: AdjustmentKind;
  points: number;
  reason: string | null;
  created_at: string;
};

const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default function AdjustmentsClient({
  teams,
  seasons,
  rows,
  tableMissing,
}: {
  teams: { id: number; name: string }[];
  seasons: string[];
  rows: AdjustmentRow[];
  tableMissing: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [season, setSeason] = useState(seasons[0] ?? "");
  const [teamId, setTeamId] = useState<number>(teams[0]?.id ?? 0);
  const [kind, setKind] = useState<AdjustmentKind>("international");
  const [points, setPoints] = useState<number>(ADJUSTMENT_PRESETS.international.points ?? 0);
  const [reason, setReason] = useState("");

  const [filter, setFilter] = useState<AdjustmentKind | "all">("all");

  const teamName = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams]
  );

  const filtered = filter === "all" ? rows : rows.filter((r) => r.kind === filter);

  const onKindChange = (k: AdjustmentKind) => {
    setKind(k);
    const preset = ADJUSTMENT_PRESETS[k].points;
    if (preset != null) setPoints(preset);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await addAdjustment({ season, teamId, kind, points, reason });
      if (!res.success) {
        setError(res.error ?? "Κάτι πήγε στραβά.");
        return;
      }
      setReason("");
      router.refresh();
    });
  };

  const remove = (id: number) => {
    setError(null);
    startTransition(async () => {
      const res = await deleteAdjustment(id);
      if (!res.success) setError(res.error ?? "Κάτι πήγε στραβά.");
      else router.refresh();
    });
  };

  const inputCls =
    "w-full rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/50";
  const labelCls = "text-xs text-white/60";

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-xl font-semibold">Γενική Κατάταξη · Χειροκίνητοι πόντοι</h2>
        <p className="mt-1 text-sm text-white/60">
          Δώσε ή αφαίρεσε πόντους σε ομάδα για οποιονδήποτε κανόνα του συστήματος
          (διεθνής διάκριση/συμμετοχή, αποχώρηση, διακοπή, ή οποιονδήποτε άλλο λόγο).
          Εμφανίζονται στη στήλη «Έξτρα» και στο δημόσιο μητρώο πόντων.
        </p>
      </header>

      {tableMissing && (
        <div className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
          Ο πίνακας <code>season_team_adjustments</code> δεν υπάρχει ακόμη στη βάση.
          Τρέξε το migration <code>migrations/add-season-team-adjustments.sql</code> στο
          Supabase για να ενεργοποιηθούν οι χειροκίνητοι πόντοι.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Grant form */}
      <section className="rounded-xl border border-white/10 bg-zinc-950 p-4">
        <h3 className="mb-3 text-sm font-semibold text-white/80">Νέα καταχώρηση</h3>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-1">
            <label className={labelCls}>Σεζόν</label>
            <input
              className={inputCls}
              list="gk-seasons"
              value={season}
              onChange={(e) => setSeason(e.target.value)}
              placeholder="π.χ. 2026"
            />
            <datalist id="gk-seasons">
              {seasons.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
            onClick={submit}
            disabled={pending || tableMissing}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            {pending ? "Αποθήκευση…" : "Καταχώρηση"}
          </button>
        </div>
      </section>

      {/* Existing grants */}
      <section className="rounded-xl border border-white/10 bg-zinc-950">
        <div className="flex flex-col gap-3 border-b border-white/10 px-4 py-3 md:flex-row md:items-center md:justify-between">
          <h3 className="text-sm font-semibold text-white/80">
            Καταχωρήσεις ({filtered.length})
          </h3>
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setFilter("all")}
              className={`rounded-md border px-2.5 py-1 text-xs transition ${
                filter === "all"
                  ? "border-emerald-400/50 bg-emerald-600/20 text-white"
                  : "border-white/15 bg-zinc-900 text-white/70 hover:bg-zinc-800"
              }`}
            >
              Όλα
            </button>
            {ADJUSTMENT_KINDS.map((k) => (
              <button
                key={k}
                onClick={() => setFilter(k)}
                className={`rounded-md border px-2.5 py-1 text-xs transition ${
                  filter === k
                    ? "border-emerald-400/50 bg-emerald-600/20 text-white"
                    : "border-white/15 bg-zinc-900 text-white/70 hover:bg-zinc-800"
                }`}
              >
                {ADJUSTMENT_PRESETS[k].label}
              </button>
            ))}
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-white/50">Δεν υπάρχουν καταχωρήσεις.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-zinc-900/60 text-left text-xs text-white/60">
                <tr>
                  <th className="px-4 py-2">Ημ/νία</th>
                  <th className="px-4 py-2">Σεζόν</th>
                  <th className="px-4 py-2">Ομάδα</th>
                  <th className="px-4 py-2">Λόγος</th>
                  <th className="px-4 py-2">Αιτιολογία</th>
                  <th className="px-4 py-2 text-right">Πόντοι</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-t border-white/5 odd:bg-zinc-950 even:bg-zinc-900/40">
                    <td className="whitespace-nowrap px-4 py-2 text-white/60">
                      {new Date(r.created_at).toLocaleDateString("el-GR")}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-white/80">{r.season}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-white">
                      {teamName.get(r.team_id) ?? `Ομάδα #${r.team_id}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <span className="rounded-md border border-white/15 bg-zinc-900 px-2 py-0.5 text-xs text-white/80">
                        {ADJUSTMENT_PRESETS[r.kind]?.label ?? r.kind}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-white/60">{r.reason ?? "—"}</td>
                    <td
                      className={`whitespace-nowrap px-4 py-2 text-right font-mono font-semibold tabular-nums ${
                        r.points < 0 ? "text-red-400" : "text-emerald-300"
                      }`}
                    >
                      {signed(r.points)}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        onClick={() => remove(r.id)}
                        disabled={pending}
                        className="inline-flex items-center justify-center rounded-md border border-white/15 bg-zinc-900 p-1.5 text-white/60 hover:bg-red-600/20 hover:text-red-300 disabled:opacity-50"
                        title="Διαγραφή"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
