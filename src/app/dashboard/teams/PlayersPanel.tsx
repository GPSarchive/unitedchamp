"use client";

import React, { useEffect, useState } from "react";
import { X, Loader2, Search, UserPlus } from "lucide-react";
import type {
  PlayerRow as Player,
  PlayerStatisticsRow as PlayerStat,
  PlayerAssociation,
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
  const [list, setList] = useState<PlayerAssociation[]>(associations ?? []);
  useEffect(() => setList(associations ?? []), [associations]);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existing" | "create">("existing");

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlayerAssociation[]>([]);
  const canSearch = q.trim().length >= 1;

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<number | "" | null>(null);

  // Extended player fields
  const [photo, setPhoto] = useState("");
  const [height, setHeight] = useState<number | "" | null>(null);
  const [position, setPosition] = useState("");
  const [birth, setBirth] = useState("");
  const [playerNumber, setPlayerNumber] = useState<number | "" | null>(null);

  // Card statistics
  const [yellowCards, setYellowCards] = useState<number | "" | null>(0);
  const [redCards, setRedCards] = useState<number | "" | null>(0);
  const [blueCards, setBlueCards] = useState<number | "" | null>(0);

  // Goals and assists
  const [goals, setGoals] = useState<number | "" | null>(0);
  const [assists, setAssists] = useState<number | "" | null>(0);

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
      setList((xs) => [...xs, data.association as PlayerAssociation]);
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
          total_goals: goals === "" ? 0 : goals,
          total_assists: assists === "" ? 0 : assists,
          photo: photo.trim() || null,
          height_cm: height === "" ? null : height,
          position: position.trim() || null,
          birth_date: birth || null,
          player_number: playerNumber === "" ? null : playerNumber,
          yellow_cards: yellowCards === "" ? 0 : yellowCards,
          red_cards: redCards === "" ? 0 : redCards,
          blue_cards: blueCards === "" ? 0 : blueCards,
        }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const player = data.player as Player;
      await addExisting(player.id);

      // Reset all fields
      setFirst("");
      setLast("");
      setAge(null);
      setPhoto("");
      setHeight(null);
      setPosition("");
      setBirth("");
      setPlayerNumber(null);
      setGoals(0);
      setAssists(0);
      setYellowCards(0);
      setRedCards(0);
      setBlueCards(0);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function removeFromTeam(playerId: number) {
    if (!teamId) return;
    if (!confirm("Να αφαιρεθεί ο παίκτης από την ομάδα;")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      setList((xs) => body.playerAssociations ?? xs.filter((a: PlayerAssociation) => a.player.id !== playerId));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div>
      {/* Header with add button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90">Τρέχον ρόστερ</h3>
        <button
          type="button"
          onClick={() => {
            setTab("existing");
            setOpen(true);
          }}
          className="text-xs px-2 py-1 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
        >
          + Προσθήκη παίκτη
        </button>
      </div>

      {/* Scrollable players list */}
      <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <p className="text-white/70 py-4">Φόρτωση παικτών…</p>
        ) : error ? (
          <p className="text-red-400 py-4">Σφάλμα φόρτωσης παικτών: {error}</p>
        ) : !list || list.length === 0 ? (
          <p className="text-gray-400 py-4">Δεν υπάρχουν παίκτες σε αυτή την ομάδα.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((pa) => {
              const p = pa.player;
              const s = (p.player_statistics[0] as PlayerStat | undefined);
              const ageSafe = s?.age ?? null;

              return (
                <div
                  key={p.id}
                  className="group relative text-left w-full p-3 border border-orange-400/20 bg-orange-500/5 shadow-md rounded-md hover:border-orange-400/40 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => removeFromTeam(p.id)}
                    className="absolute right-2 top-2 text-[11px] px-2 py-0.5 rounded border border-red-400/40 bg-red-900/30 hover:bg-red-900/50 transition-opacity"
                    title="Αφαίρεση από την ομάδα"
                  >
                    Αφαίρεση
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenPlayer(p.id)}
                    className="w-full text-left"
                    title="Επεξεργασία παίκτη"
                  >
                    <p className="text-white font-semibold pr-16">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">Ηλικία: {ageSafe ?? "—"}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                        Γκολ: {num(s?.total_goals)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                        Ασίστ: {num(s?.total_assists)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-300">
                        Κίτρινες: {num(s?.yellow_cards)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">
                        Κόκκινες: {num(s?.red_cards)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
                        Μπλε: {num(s?.blue_cards)}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side drawer for adding players */}
      <div 
        className={`fixed inset-0 z-50 transition-opacity duration-300 ${
          open ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!open}
      >
        {/* Backdrop */}
        <div 
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />
        
        {/* Side panel */}
        <div
  className={`absolute right-0 top-0 h-full w-full sm:w-full bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform duration-300 ${
    open ? "translate-x-0" : "translate-x-full"
  }`}
>
          {/* Panel header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/50">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === "existing" 
                    ? "bg-emerald-700/30 text-white border border-emerald-400/40" 
                    : "text-white/70 hover:bg-white/5"
                }`}
                onClick={() => setTab("existing")}
              >
                Προσθήκη υπάρχοντος
              </button>
              <button
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === "create" 
                    ? "bg-emerald-700/30 text-white border border-emerald-400/40" 
                    : "text-white/70 hover:bg-white/5"
                }`}
                onClick={() => setTab("create")}
              >
                Δημιουργία νέου
              </button>
            </div>
            <button 
              onClick={() => setOpen(false)} 
              className="p-2 rounded-lg hover:bg-white/10 transition-colors" 
              title="Κλείσιμο"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          {/* Panel content */}
          <div className="p-6 space-y-4 h-[calc(100vh-5rem)] overflow-y-auto custom-scrollbar">
            {tab === "existing" ? (
              <>
                <label className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-white/70" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), search()) : undefined)}
                    placeholder="Αναζήτηση με όνομα…"
                    className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                  />
                  <button
                    type="button"
                    disabled={!canSearch || searching}
                    onClick={search}
                    className="px-4 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Αναζήτηση"}
                  </button>
                </label>

                <div className="mt-4 space-y-2">
                  {results.length === 0 ? (
                    <div className="text-center py-8">
                      <Search className="h-12 w-12 text-white/20 mx-auto mb-3" />
                      <p className="text-white/60 text-sm">
                        {searching ? "Αναζήτηση..." : "Δεν υπάρχουν αποτελέσματα ακόμη."}
                      </p>
                      <p className="text-white/40 text-xs mt-1">
                        Πληκτρολογήστε ένα όνομα και πατήστε αναζήτηση
                      </p>
                    </div>
                  ) : (
                    results.map((pa) => {
                      const p = pa.player;
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between px-4 py-3 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                        >
                          <div className="text-white">
                            <div className="font-medium">
                              {p.first_name} {p.last_name}
                            </div>
                            <div className="text-white/50 text-xs">ID: #{p.id}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => addExisting(p.id)}
                            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50 transition-colors"
                          >
                            <UserPlus className="h-4 w-4" /> Προσθήκη
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 max-h-[calc(100vh-14rem)] overflow-y-auto custom-scrollbar pr-2">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Όνομα *</span>
                      <input
                        value={first}
                        onChange={(e) => setFirst(e.target.value)}
                        placeholder="π.χ. Γιάννης"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Επώνυμο *</span>
                      <input
                        value={last}
                        onChange={(e) => setLast(e.target.value)}
                        placeholder="π.χ. Παπαδόπουλος"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ηλικία</span>
                      <input
                        type="number"
                        min={0}
                        value={age === null ? "" : age}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAge(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 25"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Αριθμός φανέλας</span>
                      <input
                        type="number"
                        min={0}
                        value={playerNumber === null ? "" : playerNumber}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPlayerNumber(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 10"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Γκολ</span>
                      <input
                        type="number"
                        min={0}
                        value={goals === null ? "" : goals}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGoals(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ασίστ</span>
                      <input
                        type="number"
                        min={0}
                        value={assists === null ? "" : assists}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAssists(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Extended Profile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm text-white/80 font-medium">Φωτογραφία (διαδρομή)</span>
                      <input
                        value={photo}
                        onChange={(e) => setPhoto(e.target.value)}
                        placeholder="π.χ. players/john-doe/photo.jpg"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ύψος (cm)</span>
                      <input
                        type="number"
                        min={0}
                        value={height === null ? "" : height}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeight(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 180"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Θέση</span>
                      <input
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="π.χ. RW, CF"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm text-white/80 font-medium">Ημερομηνία γέννησης</span>
                      <input
                        type="date"
                        value={birth}
                        onChange={(e) => setBirth(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Card Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Κίτρινες κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={yellowCards === null ? "" : yellowCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setYellowCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Κόκκινες κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={redCards === null ? "" : redCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRedCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Μπλε κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={blueCards === null ? "" : blueCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBlueCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10 mt-4">
                  <button
                    type="button"
                    disabled={!validCreate}
                    onClick={createAndAdd}
                    className="px-4 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Δημιουργία & προσθήκη
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}