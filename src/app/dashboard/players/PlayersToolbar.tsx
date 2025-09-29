"use client";

import React from "react";

type Props = {
  q: string;
  onChangeQ: (v: string) => void;
  onSearch: () => void;
  onNew: () => void;
};

export default function PlayersToolbar({ q, onChangeQ, onSearch, onNew }: Props) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <input
        value={q}
        onChange={(e) => onChangeQ(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" ? onSearch() : undefined)}
        placeholder="Αναζητηση παικτων"
        className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
      />
      <button
        type="button"
        onClick={onSearch}
        className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
      >
        Αναζητηση
      </button>
      <div className="flex-1" />
      <button
        type="button"
        onClick={onNew}
        className="px-3 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50"
      >
        + Νεος Παικτής
      </button>
    </div>
  );
}
