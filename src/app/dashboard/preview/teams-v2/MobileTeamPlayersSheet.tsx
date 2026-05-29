// src/app/dashboard/preview/teams-v2/MobileTeamPlayersSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";
import { X, RefreshCw, Search, UserPlus, Trash2 } from "lucide-react";
import type { PlayerAssociation, PlayerRow } from "@/app/lib/types";
import { safeJson } from "../../teams/teamHelpers";
import type { TeamCardRow } from "./MobileTeamCard";

type Props = {
  team: TeamCardRow;
  associations?: PlayerAssociation[];
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
  onReload: () => void;
};

type Mode = "list" | "add" | "create";

function MobileTeamPlayersSheetComponent({
  team,
  associations,
  isLoading,
  error,
  onClose,
  onReload,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<Mode>("list");

  const [list, setList] = useState<PlayerAssociation[]>(associations ?? []);
  useEffect(() => setList(associations ?? []), [associations]);

  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlayerRow[]>([]);

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [playerNumber, setPlayerNumber] = useState<string>("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  async function searchExisting() {
    if (!q.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/players?q=${encodeURIComponent(q.trim())}&excludeTeamId=${team.id}`,
        { credentials: "include" }
      );
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setResults((body?.players as PlayerRow[]) ?? []);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSearching(false);
    }
  }

  async function addExisting(playerId: number) {
    try {
      const res = await fetch(`/api/teams/${team.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ player_id: playerId }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const assoc = body?.association as PlayerAssociation | undefined;
      if (assoc) setList((xs) => [...xs, assoc]);
      setResults((xs) => xs.filter((p) => p.id !== playerId));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function createAndAdd() {
    if (!first.trim() || !last.trim()) return;
    try {
      const res = await fetch(`/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          position: position.trim() || null,
          player_number:
            playerNumber.trim() && Number.isFinite(Number(playerNumber))
              ? Number(playerNumber)
              : null,
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      const player = body?.player as PlayerRow;
      if (player) await addExisting(player.id);
      setFirst("");
      setLast("");
      setPlayerNumber("");
      setPosition("");
      setMode("list");
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function removeFromTeam(playerId: number) {
    if (!confirm("Αφαίρεση παίκτη από την ομάδα;")) return;
    try {
      const res = await fetch(`/api/teams/${team.id}/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setList(
        (body?.playerAssociations as PlayerAssociation[]) ??
          list.filter((a) => a.player.id !== playerId)
      );
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  const TabBtn = ({ value, label }: { value: Mode; label: string }) => {
    const active = mode === value;
    return (
      <button
        onClick={() => setMode(value)}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          active
            ? "bg-zinc-800 text-white"
            : "text-white/60 hover:text-white"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50">
      <div
        onClick={onClose}
        className={`absolute inset-0 bg-black/70 transition-opacity duration-200 ${
          mounted ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Ρόστερ · ${team.name}`}
        className={`absolute inset-x-0 bottom-0 top-[6vh] sm:top-auto sm:bottom-4 sm:right-4 sm:left-auto sm:w-[560px] sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl flex flex-col
          bg-zinc-950 border border-white/10 shadow-2xl rounded-t-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pt-3 pb-3 flex items-start gap-3 border-b border-white/10 shrink-0">
          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-white/10 bg-zinc-900 grid place-items-center">
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={team.logo} alt={team.name} className="h-full w-full object-contain" />
            ) : (
              <span className="text-[10px] text-white/30">—</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-white truncate">{team.name}</div>
            <div className="mt-0.5 text-xs text-white/55">
              <span className="tabular-nums text-white">{list.length}</span>{" "}
              {list.length === 1 ? "παίκτης" : "παίκτες"}
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="shrink-0 -mr-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-white/55 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-3 pt-2 pb-2 flex items-center gap-1 border-b border-white/10 shrink-0">
          <TabBtn value="list" label="Ρόστερ" />
          <TabBtn value="add" label="Προσθήκη" />
          <TabBtn value="create" label="Νέος" />
          <button
            onClick={onReload}
            aria-label="Ανανέωση"
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-md text-white/55 hover:bg-white/5 hover:text-white"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {mode === "list" && (
            <>
              {isLoading ? (
                <p className="px-2 py-8 text-center text-sm text-white/55">Φόρτωση…</p>
              ) : error ? (
                <p className="px-2 py-8 text-center text-sm text-red-400">{error}</p>
              ) : list.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/15 bg-zinc-900/40 px-4 py-8 text-center">
                  <p className="text-sm font-semibold text-white">Άδειο ρόστερ</p>
                  <p className="mt-1 text-xs text-white/55">
                    Χρησιμοποίησε Προσθήκη ή Νέος.
                  </p>
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {list.map((pa) => {
                    const p = pa.player;
                    const s = p.player_statistics?.[0];
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white truncate">
                            {p.first_name} {p.last_name}
                          </div>
                          <div className="mt-0.5 text-xs text-white/55 truncate">
                            {p.player_number != null && (
                              <span className="text-white/80">#{p.player_number}</span>
                            )}
                            {p.position && (
                              <>
                                {p.player_number != null && (
                                  <span className="mx-1.5 text-white/25">·</span>
                                )}
                                <span>{p.position}</span>
                              </>
                            )}
                            {s && (
                              <>
                                <span className="mx-1.5 text-white/25">·</span>
                                <span className="tabular-nums">
                                  {s.total_goals ?? 0}γ {s.total_assists ?? 0}α
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromTeam(p.id)}
                          aria-label="Αφαίρεση"
                          className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-md text-red-400/80 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {mode === "add" && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40 pointer-events-none" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        searchExisting();
                      }
                    }}
                    placeholder="Όνομα παίκτη…"
                    className="w-full rounded-lg border border-white/15 bg-zinc-900 pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                </div>
                <button
                  onClick={searchExisting}
                  disabled={!q.trim() || searching}
                  className="shrink-0 rounded-lg border border-blue-500/50 bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
                >
                  {searching ? "…" : "Αναζήτηση"}
                </button>
              </div>

              {results.length === 0 ? (
                <p className="px-2 py-8 text-center text-sm text-white/45">
                  {searching ? "Αναζήτηση…" : "Πληκτρολόγησε ένα όνομα."}
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="mt-0.5 text-xs text-white/55">
                          ID #{p.id}
                          {p.position && (
                            <>
                              <span className="mx-1.5 text-white/25">·</span>
                              {p.position}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addExisting(p.id)}
                        className="shrink-0 inline-flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-600/20 px-2.5 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-600/30 transition-colors"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Προσθήκη
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-white/55">Όνομα *</span>
                  <input
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                    className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-white/55">Επώνυμο *</span>
                  <input
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                    className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-white/55">Φανέλα</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
                    className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-white/55">Θέση</span>
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="π.χ. CF"
                    className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
                  />
                </label>
              </div>
              <button
                onClick={createAndAdd}
                disabled={!first.trim() || !last.trim()}
                className="w-full rounded-lg border border-blue-500/50 bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                Δημιουργία & προσθήκη
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const MobileTeamPlayersSheet = memo(MobileTeamPlayersSheetComponent);
export default MobileTeamPlayersSheet;
