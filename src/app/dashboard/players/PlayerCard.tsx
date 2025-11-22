//app/dashboard/players/PlayerCard.tsx
"use client";

import React from "react";
import type { PlayerWithStats } from "./types";
import PlayerPhoto from "./PlayerPhoto"; // <-- add this import

type Props = {
  player: PlayerWithStats;
  onEdit: () => void;
  onDelete: () => void;
};

function num(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export default function PlayerCard({ player, onEdit, onDelete }: Props) {
  const raw: any | undefined = player.player_statistics?.[0];

  const stats = {
    age: raw?.age ?? null,
    total_goals: num(raw?.total_goals),
    total_assists: num(raw?.total_assists),
    yellow_cards: num(raw?.yellow_cards),
    red_cards: num(raw?.red_cards),
    blue_cards: num(raw?.blue_cards),
    updated_at: raw?.updated_at ?? raw?.created_at ?? null,
  };

  const fullName = `${player.first_name} ${player.last_name}`;

  return (
    <div className="p-3 rounded-lg border border-white/10 bg-zinc-950/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-white font-semibold truncate">
            {fullName} <span className="text-white/40 text-xs">#{player.id}</span>
          </p>
          <p className="text-white/70 text-sm mt-1">Age: {stats.age ?? "N/A"}</p>

          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
              Goals: {stats.total_goals}
            </span>
            <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
              Assists: {stats.total_assists}
            </span>
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-300">
              YC: {stats.yellow_cards}
            </span>
            <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">
              RC: {stats.red_cards}
            </span>
            <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
              BC: {stats.blue_cards}
            </span>
          </div>

          {stats.updated_at && (
            <p className="mt-2 text-[11px] text-white/50">
              Last updated: {new Date(stats.updated_at).toLocaleString('el-GR')}
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
            <button
              type="button"
              onClick={onEdit}
              className="px-2 py-1 text-xs rounded border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="px-2 py-1 text-xs rounded border border-red-400/40 text-red-200 bg-red-900/30 hover:bg-red-900/50"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
