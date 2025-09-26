
// ===============================
// File: app/components/DashboardPageComponents/TournamentCURD/preview/MatchPlanner/MatchRow.tsx
// ===============================
"use client";

import AdvancedRowMenu from "./AdvancedRowMenu";
import { inferStatus, isoToLocalInput, localInputToISO } from "./utils";
import type { EditableDraftMatch, TeamOption } from "./types";

export default function MatchRow({
  m,
  isKO,
  isGroups,
  groups,
  stageBadge,
  teamOptions,
  getEff,
  hasPending,
  setPendingFor,
  saveRow,
  swapTeams,
  removeRow,
  teamLabel,
  busy,
}: {
  m: EditableDraftMatch;
  isKO: boolean;
  isGroups: boolean;
  groups: Array<{ name: string } & any>;
  stageBadge: (m: any) => string;
  teamOptions: TeamOption[];
  getEff: <K extends keyof EditableDraftMatch>(row: EditableDraftMatch, key: K) => EditableDraftMatch[K];
  hasPending: (localId: number) => boolean;
  setPendingFor: (localId: number, patch: Partial<EditableDraftMatch>) => void;
  saveRow: (localId: number) => void;
  swapTeams: (localId: number) => void;
  removeRow: (localId: number) => void;
  teamLabel: (id?: number | null) => string;
  busy: boolean;
}) {
  const lid = m._localId!;
  const isDirty = hasPending(lid);

  return (
    <tr key={`row-${lid}`} className="odd:bg-zinc-950/60 even:bg-zinc-900/40">
      {/* Stage / Group label */}
      <td className="px-2 py-1">
        <span className="inline-flex items-center rounded-md bg-white/5 px-2 py-0.5 text-xs text-white/80 ring-1 ring-white/10">
          {stageBadge(m)}
        </span>
      </td>

      {isKO ? (
        <>
          <td className="px-2 py-1">
            <input
              type="number"
              className="w-20 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={m.round ?? 1}
              onChange={(e) => setPendingFor(lid, { round: Number(e.target.value) || 1, matchday: null })}
            />
          </td>
          <td className="px-2 py-1">
            <input
              type="number"
              className="w-24 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
              value={m.bracket_pos ?? 1}
              onChange={(e) => setPendingFor(lid, { bracket_pos: Number(e.target.value) || 1 })}
            />
          </td>
        </>
      ) : (
        <td className="px-2 py-1">
          <input
            type="number"
            className="w-16 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
            value={m.matchday ?? 1}
            onChange={(e) => setPendingFor(lid, { matchday: Number(e.target.value) || 1 })}
          />
        </td>
      )}

      {/* Team A select */}
      <td className="px-2 py-1">
        <select
          className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
          value={m.team_a_id ?? ""}
          onChange={(e) => setPendingFor(lid, { team_a_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{teamLabel(null)}</option>
          {teamOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
          {m.team_a_id && !teamOptions.some((o) => o.id === m.team_a_id) && (
            <option value={m.team_a_id!}>{teamLabel(m.team_a_id!)} (εκτός ομίλου)</option>
          )}
        </select>
      </td>

      {/* Team B select */}
      <td className="px-2 py-1">
        <select
          className="min-w-48 bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
          value={m.team_b_id ?? ""}
          onChange={(e) => setPendingFor(lid, { team_b_id: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">{teamLabel(null)}</option>
          {teamOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
          {m.team_b_id && !teamOptions.some((o) => o.id === m.team_b_id) && (
            <option value={m.team_b_id!}>{teamLabel(m.team_b_id!)} (εκτός ομίλου)</option>
          )}
        </select>
      </td>

      {/* Score cell */}
      <td className="px-2 py-1">
        {(() => {
          const a = m.team_a_score ?? null;
          const b = m.team_b_score ?? null;
          const has = a != null || b != null;
          return has ? `${a ?? 0} – ${b ?? 0}` : <span className="text-white/50">—</span>;
        })()}
      </td>

      {/* Status cell */}
      <td className="px-2 py-1">
        {(() => {
          const st = m.status ??
            inferStatus({
              status: m.status,
              team_a_score: m.team_a_score,
              team_b_score: m.team_b_score,
              winner_team_id: m.winner_team_id,
            });
          return (
            <span
              className={[
                "inline-flex items-center rounded px-2 py-0.5 text-xs",
                st === "finished"
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-500/30"
                  : "bg-zinc-500/10 text-zinc-300 ring-1 ring-white/10",
              ].join(" ")}
            >
              {st}
            </span>
          );
        })()}
      </td>

      {/* Date */}
      <td className="px-2 py-1">
        <input
          type="datetime-local"
          className="bg-slate-950 border border-white/15 rounded px-2 py-1 text-white"
          value={isoToLocalInput(m.match_date)}
          onChange={(e) => setPendingFor(lid, { match_date: localInputToISO(e.target.value) })}
        />
      </td>

      {/* Actions */}
      <td className="px-2 py-1">
        <div className="flex items-center justify-end gap-2">
          <label className="inline-flex items-center gap-1 text-xs text-white/80">
            <input
              type="checkbox"
              checked={!!m.locked}
              onChange={(e) => setPendingFor(lid, { locked: e.target.checked })}
            />
            Κλείδωμα
          </label>

          <button
            className={`px-2 py-1 rounded border text-xs ${
              isDirty
                ? "border-emerald-400/40 text-emerald-200 hover:bg-emerald-500/10"
                : "border-white/10 text-white/60 cursor-not-allowed"
            }`}
            disabled={!isDirty || busy}
            onClick={() => saveRow(lid)}
            title={isDirty ? "Αποθήκευση αλλαγών για αυτόν τον αγώνα" : "Καμία αλλαγή"}
          >
            Αποθήκευση
          </button>

          <button
            className="px-2 py-1 rounded border border-white/15 hover:bg-white/10 text-xs disabled:opacity-50"
            onClick={() => swapTeams(lid)}
            disabled={busy}
            title="Αντιστροφή ομάδων (σε εκκρεμότητα αν υπάρχουν αλλαγές)"
          >
            Αντιστροφή
          </button>

          <AdvancedRowMenu row={m} getEff={getEff} setPendingFor={setPendingFor} teamOptions={teamOptions} />

          <button
            className="px-2 py-1 rounded border border-rose-400/30 text-rose-200 hover:bg-rose-500/10 text-xs disabled:opacity-50"
            onClick={() => removeRow(lid)}
            disabled={busy}
          >
            Διαγραφή
          </button>
        </div>
      </td>
    </tr>
  );
}
