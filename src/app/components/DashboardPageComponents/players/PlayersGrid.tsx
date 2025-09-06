"use client";

import React from "react";
import type { PlayerWithStats } from "./types";
import PlayerCard from "./PlayerCard";

type Props = {
  players: PlayerWithStats[];
  onEdit: (p: PlayerWithStats) => void;
  onDelete: (id: number) => void;
};

export default function PlayersGrid({ players, onEdit, onDelete }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {players.map((p) => (
        <PlayerCard key={p.id} player={p} onEdit={() => onEdit(p)} onDelete={() => onDelete(p.id)} />
      ))}
    </div>
  );
}
