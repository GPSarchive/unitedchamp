//components/DashboardPageComponents/teams/TeamRowItem.tsx
"use client";

import React from "react";
import { ChevronDown, ChevronRight, Edit3, Trash2, RotateCcw } from "lucide-react";
import Logo from "./Logo";
import TeamRowEditor from "./TeamRowEditor";

import type {
  TeamRow,
  PlayerAssociation,
  PlayerStatisticsRow as PlayerStat,
} from "@/app/lib/types";

export default function TeamRowItem({
  row,
  isExpanded,
  editing,
  onToggle,
  onEditOpen,
  onDelete,
  onRestore,          // 👈 NEW
  onCancelEdit,
  onSaved,
  players,
  playersLoading,
  playersError,
  openPlayer,
}: {
  row: TeamRow;
  isExpanded: boolean;
  editing: boolean;
  onToggle: (id: number) => void;
  onEditOpen: (id: number) => void;
  onDelete: (id: number) => void;
  onRestore: (id: number) => void;   // 👈 NEW
  onCancelEdit: () => void;
  onSaved: (saved: TeamRow) => void;
  players: PlayerAssociation[] | undefined;
  playersLoading: boolean;
  playersError: string | null;
  openPlayer: (teamId: number, playerId: number) => void;
}) {
  const archived = !!row.deleted_at;

  return (
    <>
      <tr className={`align-top ${archived ? "bg-zinc-900/30 opacity-70" : "odd:bg-zinc-950/60 even:bg-zinc-900/40"}`}>
        <td className="px-3 py-2">
          {editing ? (
            <TeamRowEditor initial={row} onCancel={onCancelEdit} onSaved={onSaved} />
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onToggle(row.id)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-black/30 hover:bg-black/40"
                title={isExpanded ? "Hide players" : "Show players"}
              >
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <Logo src={row.logo} alt={row.name} />
              <div>
                <div className="font-semibold flex items-center gap-2">
                  <span className={archived ? "line-through decoration-white/40" : ""}>{row.name}</span>
                  {archived && (
                    <span className="text-xs px-2 py-0.5 rounded-full border border-amber-400/40 bg-amber-500/10 text-amber-200">
                      Archived
                    </span>
                  )}
                </div>
                <div className="text-xs text-white/50">
                  ID #{row.id}
                  {archived && row.deleted_at && (
                    <span className="ml-2">• deleted {new Date(row.deleted_at).toLocaleDateString()}</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </td>
        <td className="px-3 py-2 whitespace-nowrap">
          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
        </td>
        <td className="px-3 py-2">
          {!editing && (
            <div className="flex items-center gap-2 justify-end">
              {!archived ? (
                <>
                  <button
                    onClick={() => onEditOpen(row.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/15 bg-zinc-900 hover:bg-zinc-800"
                  >
                    <Edit3 className="h-4 w-4" /> Edit
                  </button>
                  <button
                    onClick={() => onDelete(row.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                </>
              ) : (
                <button
                  onClick={() => onRestore(row.id)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                  title="Restore team"
                >
                  <RotateCcw className="h-4 w-4" /> Restore
                </button>
              )}
            </div>
          )}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-black/30">
          <td className="px-3 pt-0 pb-4" colSpan={3}>
            <div className="mt-2 rounded-xl border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-4">
              <h3 className="text-sm font-semibold text-white/90 mb-3">Current Players</h3>

              {playersLoading ? (
                <p className="text-white/70">Loading players…</p>
              ) : playersError ? (
                <p className="text-red-400">Error loading players: {playersError}</p>
              ) : !players || players.length === 0 ? (
                <p className="text-gray-400">No players currently on this team.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  {players.map((pa) => {
                    const p = pa.player;
                    const s = (p.player_statistics?.[0] as PlayerStat | undefined) ?? {
                      age: null,
                      total_goals: 0,
                      total_assists: 0,
                    };
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => openPlayer(row.id, p.id)}
                        className="text-left w-full p-3 border border-orange-400/20 bg-orange-500/5 shadow-md hover:shadow-lg hover:border-orange-400/40 transition rounded-md"
                        title="Edit player"
                        disabled={archived} // optional: block editing players while archived
                      >
                        <p className="text-white font-semibold">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-gray-300 text-sm mt-1">Age: {s.age ?? "N/A"}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300">
                            Goals: {s.total_goals}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-xs text-orange-300">
                            Assists: {s.total_assists}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
