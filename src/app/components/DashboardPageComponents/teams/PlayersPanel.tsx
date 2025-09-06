//components/DashboardPageComponents/teams/PlayersPanel.tsx
"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, Search, UserPlus } from "lucide-react";
import type {
  PlayerRow as Player,
  PlayerStatisticsRow as PlayerStat,
  PlayerAssociation, // ✅ normalized UI shape (player_statistics is always an array 0..1)
} from "@/app/lib/types";

type Props = {
  teamId: number;
  associations?: PlayerAssociation[];
  isLoading: boolean;
  error?: string | null;
  onOpenPlayer: (playerId: number) => void;
};

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

export default function PlayersPanel({
  teamId,
  associations,
  isLoading,
  error,
  onOpenPlayer,
}: Props) {
  // local copy so add/remove feel instant
  const [list, setList] = useState<PlayerAssociation[]>(associations ?? []);
  useEffect(() => setList(associations ?? []), [associations]);

  // Drawer state
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existing" | "create">("existing");

  // Search existing
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlayerAssociation[]>([]);
  const canSearch = q.trim().length >= 1;

  // Create new
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<number | "" | null>(null);
  const validCreate = !!(first.trim() && last.trim());

  async function search() {
    if (!canSearch) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/players?q=${encodeURIComponent(q)}&excludeTeamId=${teamId}`, {
        credentials: "include",
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const players = (data.players as Player[]) ?? [];
      // Map bare players into normalized association shape (stats empty array)
      setResults(players.map(p => ({ player: { ...p, player_statistics: [] } })));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }

  async function addExisting(playerId: number) {
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ player_id: playerId }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setList((xs) => [...xs, data.association as PlayerAssociation]); // server returns normalized association
      setOpen(false);
      setQ("");
      setResults([]);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function createAndAdd() {
    try {
      const res = await fetch(`/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          age: age === "" ? null : age,
        }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const player = data.player as Player;
      await addExisting(player.id); // reuse existing adder
      setFirst("");
      setLast("");
      setAge(null);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function removeFromTeam(playerId: number) {
    if (!teamId) return;
    if (!confirm("Remove this player from the team?")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // use the refreshed list returned by the API (fallback to local filter)
      setList((xs) => body.playerAssociations ?? xs.filter((a: PlayerAssociation) => a.player.id !== playerId));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div className="mt-2 rounded-xl border border-orange-400/20 bg-gradient-to-b from-orange-500/10 to-transparent p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90">Current Players</h3>
        <button
          type="button"
          onClick={() => {
            setTab("existing");
            setOpen(true);
          }}
          className="text-xs px-2 py-1 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
        >
          + Add player
        </button>
      </div>

      {isLoading ? (
        <p className="text-white/70">Loading players…</p>
      ) : error ? (
        <p className="text-red-400">Error loading players: {error}</p>
      ) : !list || list.length === 0 ? (
        <p className="text-gray-400">No players currently on this team.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {list.map((pa) => {
            const p = pa.player;
            const s = (p.player_statistics[0] as PlayerStat | undefined);
            const ageSafe = s?.age ?? null;

            return (
              <div key={p.id} className="group relative text-left w-full p-3 border border-orange-400/20 bg-orange-500/5 shadow-md rounded-md">
                <button
                  type="button"
                  onClick={() => removeFromTeam(p.id)}
                  className="absolute right-2 top-2 hidden group-hover:inline-flex text-[11px] px-2 py-0.5 rounded border border-red-400/40 bg-red-900/30 hover:bg-red-900/50"
                  title="Remove from team"
                >
                  Remove
                </button>

                <button
                  type="button"
                  onClick={() => onOpenPlayer(p.id)}
                  className="w-full text-left hover:shadow-lg hover:border-orange-400/40 transition rounded-md"
                  title="Edit player"
                >
                  <p className="text-white font-semibold">{p.first_name} {p.last_name}</p>
                  <p className="text-gray-300 text-sm mt-1">Age: {ageSafe ?? "N/A"}</p>

                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                      Goals: {num(s?.total_goals)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                      Assists: {num(s?.total_assists)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-300">
                      YC: {num(s?.yellow_cards)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">
                      RC: {num(s?.red_cards)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
                      BC: {num(s?.blue_cards)}
                    </span>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Drawer */}
      <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
        <div className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={() => setOpen(false)} />
        <div
          className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform ${
            open ? "translate-x-0" : "translate-x-full"
          }`}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <button
                className={`px-2 py-1 rounded ${tab === "existing" ? "bg-white/10" : ""}`}
                onClick={() => setTab("existing")}
              >
                Add existing
              </button>
              <button
                className={`px-2 py-1 rounded ${tab === "create" ? "bg-white/10" : ""}`}
                onClick={() => setTab("create")}
              >
                Create new
              </button>
            </div>
            <button onClick={() => setOpen(false)} className="p-2 rounded-lg hover:bg-white/10" title="Close">
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {tab === "existing" ? (
              <>
                <label className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-white/70" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), search()) : undefined)}
                    placeholder="Search by first or last name…"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                  />
                  <button
                    type="button"
                    disabled={!canSearch || searching}
                    onClick={search}
                    className="px-3 py-2 rounded-lg border border-white/15 bg-zinc-900 text-white disabled:opacity-50"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
                  </button>
                </label>

                <div className="mt-3 space-y-2">
                  {results.length === 0 ? (
                    <p className="text-white/60 text-sm">No results yet.</p>
                  ) : (
                    results.map((pa) => {
                      const p = pa.player;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-3 py-2 rounded border border-white/10 bg-zinc-900"
                        >
                          <div className="text-white">
                            {p.first_name} {p.last_name} <span className="text-white/50 text-xs">#{p.id}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => addExisting(p.id)}
                            className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                          >
                            <UserPlus className="h-3 w-3" /> Add
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-white/80">First name</span>
                    <input
                      value={first}
                      onChange={(e) => setFirst(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-white/80">Last name</span>
                    <input
                      value={last}
                      onChange={(e) => setLast(e.target.value)}
                      className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                    />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="text-sm text-white/80">Age</span>
                    <input
                      type="number"
                      min={0}
                      value={age === null ? "" : age}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAge(v === "" ? "" : Number(v));
                      }}
                      className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                    />
                  </label>
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={!validCreate}
                    onClick={createAndAdd}
                    className="px-3 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50"
                  >
                    Create & add to team
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
