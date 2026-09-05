//app/dashboard/players/PlayerCard.tsx
"use client";

// One player in the admin grid. Numbers are the ACTIVE season's
// (player_season_stats via GET /api/players); age is derived from birth_date,
// falling back to the legacy hand-typed value while that column still exists.

import React from "react";
import type { PlayerWithStats } from "./types";
import PlayerPhoto from "./PlayerPhoto";
import { ageFromBirthDate } from "@/app/lib/playerAge";

type Props = {
  player: PlayerWithStats;
  onEdit: () => void;
  onDelete: () => void;
  onRestore?: () => void;
};

export default function PlayerCard({ player, onEdit, onDelete, onRestore }: Props) {
  const legacy: { age?: number | null } | undefined = player.player_statistics?.[0];
  const ss = player.season_stats ?? null;
  const isArchived = !!(player as any).deleted_at;
  const age = ageFromBirthDate(player.birth_date) ?? legacy?.age ?? null;
  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className={`p-3 rounded-lg border ${isArchived ? "border-amber-500/30 opacity-70" : "border-white/10"} bg-zinc-950/60`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`font-semibold truncate ${isArchived ? "text-white/50 line-through" : "text-white"}`}>
            {fullName} <span className="text-white/40 text-xs">#{player.id}</span>
            {isArchived && (
              <span className="ml-2 no-underline text-[10px] uppercase font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                Αρχειοθετημένος
              </span>
            )}
          </p>
          <p className="text-white/70 text-sm mt-1">
            Ηλικία: {age ?? "—"}
            {player.position ? <span className="text-white/50"> · {player.position}</span> : null}
          </p>

          {ss ? (
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-white/80">Αγ. {ss.matches}</span>
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">Γκολ {ss.goals}</span>
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">Ασίστ {ss.assists}</span>
              <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-300">ΚΚ {ss.yellow_cards}</span>
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">ΚΟΚ {ss.red_cards}</span>
              <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">ΜΠΛ {ss.blue_cards}</span>
              {ss.mvp_count > 0 && (
                <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-emerald-300">MVP {ss.mvp_count}</span>
              )}
            </div>
          ) : (
            <p className="mt-2 text-xs text-white/45">Χωρίς συμμετοχή στην τρέχουσα σεζόν.</p>
          )}

          {ss?.updated_at && (
            <p className="mt-2 text-[11px] text-white/50">
              Σεζόν {ss.season_label} · ενημέρωση {new Date(ss.updated_at).toLocaleString("el-GR")}
            </p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 shrink-0">
          {/* player.photo stores the STORAGE PATH when using a private bucket */}
          {player.photo ? (
            <PlayerPhoto
              path={player.photo}
              alt={fullName}
              className="h-12 w-12 rounded-md object-cover border border-white/10"
            />
          ) : null}

          <div className="flex gap-2">
            {!isArchived && (
              <button
                type="button"
                onClick={onEdit}
                className="px-2 py-1 text-xs rounded border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
              >
                Edit
              </button>
            )}
            {isArchived && onRestore ? (
              <button
                type="button"
                onClick={onRestore}
                className="px-2 py-1 text-xs rounded border border-emerald-400/40 text-emerald-200 bg-emerald-900/30 hover:bg-emerald-900/50"
              >
                Επαναφορα
              </button>
            ) : !isArchived ? (
              <button
                type="button"
                onClick={onDelete}
                className="px-2 py-1 text-xs rounded border border-red-400/40 text-red-200 bg-red-900/30 hover:bg-red-900/50"
              >
                Αρχειοθετηση
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
