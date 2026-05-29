// src/app/dashboard/preview/teams-v2/MobileTeamPlayersSheet.tsx
"use client";

import { memo, useEffect, useState } from "react";
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

  // local list reflects associations + optimistic mutations
  const [list, setList] = useState<PlayerAssociation[]>(associations ?? []);
  useEffect(() => setList(associations ?? []), [associations]);

  // search existing
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlayerRow[]>([]);

  // create new
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

  const accent = team.colour || "#fb923c";

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
        className={`absolute inset-x-0 bottom-0 top-[8vh] flex flex-col
          bg-[#0a0a14] border-t-2 border-[#F3EFE6]/20 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#F3EFE6]/30" />
        </div>

        {/* Header */}
        <div className="px-4 pt-1 pb-3 flex items-start gap-3 border-b border-[#F3EFE6]/10 shrink-0">
          <div
            className="relative h-11 w-11 shrink-0 overflow-hidden border-2 grid place-items-center"
            style={{ borderColor: accent, background: "#0a0a14" }}
          >
            {team.logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={team.logo}
                alt={team.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/40">
                —
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-[var(--f-display)] text-base font-semibold italic text-[#F3EFE6] truncate">
              {team.name}
            </div>
            <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
              Ρόστερ · <span className="text-[#fb923c]">{list.length}</span> παίκτες
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="shrink-0 h-9 w-9 flex items-center justify-center text-[#F3EFE6]/60 active:text-[#F3EFE6]"
          >
            <span className="text-[18px] leading-none">✕</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="px-3 pt-2 pb-2 flex items-center gap-2 border-b border-[#F3EFE6]/10 shrink-0">
          <button
            onClick={() => setMode("list")}
            className={`px-3 py-2 border-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
              mode === "list"
                ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70"
            }`}
          >
            Ρόστερ
          </button>
          <button
            onClick={() => setMode("add")}
            className={`px-3 py-2 border-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
              mode === "add"
                ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70"
            }`}
          >
            Προσθήκη
          </button>
          <button
            onClick={() => setMode("create")}
            className={`px-3 py-2 border-2 font-mono text-[10px] uppercase tracking-[0.22em] transition-colors ${
              mode === "create"
                ? "border-[#fb923c] bg-[#fb923c] text-[#0a0a14]"
                : "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/70"
            }`}
          >
            Δημιουργία
          </button>
          <button
            onClick={onReload}
            aria-label="Ανανέωση"
            className="ml-auto px-3 py-2 border-2 border-[#F3EFE6]/20 bg-[#13131d] font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/70 active:text-[#F3EFE6] transition-colors"
          >
            ↻
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-3 py-3">
          {mode === "list" && (
            <>
              {isLoading ? (
                <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
                  Φόρτωση…
                </p>
              ) : error ? (
                <p className="px-2 py-6 text-center font-mono text-[11px] uppercase tracking-[0.25em] text-red-400">
                  {error}
                </p>
              ) : list.length === 0 ? (
                <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 px-4 py-8 text-center">
                  <p className="font-[var(--f-display)] text-base font-semibold italic text-[#F3EFE6]">
                    Άδειο ρόστερ
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
                    Προσθήκη ή Δημιουργία παίκτη
                  </p>
                </div>
              ) : (
                <ul className="space-y-2">
                  {list.map((pa) => {
                    const p = pa.player;
                    const s = p.player_statistics?.[0];
                    return (
                      <li
                        key={p.id}
                        className="flex items-center gap-3 border-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-[var(--f-display)] text-[14px] font-semibold italic text-[#F3EFE6] truncate">
                            {p.first_name} {p.last_name}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                            {p.player_number != null && (
                              <span className="text-[#fb923c]">#{p.player_number}</span>
                            )}
                            {p.position && (
                              <>
                                {p.player_number != null && (
                                  <span className="text-[#F3EFE6]/25">·</span>
                                )}
                                <span className="truncate">{p.position}</span>
                              </>
                            )}
                            {s && (
                              <>
                                <span className="text-[#F3EFE6]/25">·</span>
                                <span>
                                  ⚽ {s.total_goals ?? 0} · 🅰 {s.total_assists ?? 0}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromTeam(p.id)}
                          className="shrink-0 border-2 border-red-400/40 bg-red-900/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-red-300 active:bg-red-900/50 transition-colors"
                        >
                          Αφαίρεση
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
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      searchExisting();
                    }
                  }}
                  placeholder="Αναζήτηση παίκτη…"
                  className="flex-1 border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/30 focus:border-[#fb923c] focus:outline-none transition-colors"
                />
                <button
                  onClick={searchExisting}
                  disabled={!q.trim() || searching}
                  className="shrink-0 border-2 border-[#fb923c] bg-[#fb923c] px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a14] disabled:opacity-50 transition-colors"
                >
                  {searching ? "…" : "Ψάξε"}
                </button>
              </div>

              {results.length === 0 ? (
                <p className="px-2 py-6 text-center font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/45">
                  {searching ? "Αναζήτηση…" : "Πληκτρολογήστε για αναζήτηση"}
                </p>
              ) : (
                <ul className="space-y-2">
                  {results.map((p) => (
                    <li
                      key={p.id}
                      className="flex items-center gap-3 border-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-[var(--f-display)] text-[14px] font-semibold italic text-[#F3EFE6] truncate">
                          {p.first_name} {p.last_name}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                          ID #{p.id}
                          {p.position && (
                            <>
                              <span className="text-[#F3EFE6]/25 mx-2">·</span>
                              {p.position}
                            </>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => addExisting(p.id)}
                        className="shrink-0 border-2 border-emerald-400/50 bg-emerald-700/30 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-emerald-300 active:bg-emerald-700/50 transition-colors"
                      >
                        + Προσθήκη
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {mode === "create" && (
            <div className="space-y-3">
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                  Όνομα *
                </span>
                <input
                  value={first}
                  onChange={(e) => setFirst(e.target.value)}
                  className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                  Επώνυμο *
                </span>
                <input
                  value={last}
                  onChange={(e) => setLast(e.target.value)}
                  className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                    Φανέλα
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={playerNumber}
                    onChange={(e) => setPlayerNumber(e.target.value)}
                    className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                    Θέση
                  </span>
                  <input
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="π.χ. CF"
                    className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-2.5 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
                  />
                </label>
              </div>
              <button
                onClick={createAndAdd}
                disabled={!first.trim() || !last.trim()}
                className="w-full border-2 border-[#fb923c] bg-[#fb923c] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#0a0a14] disabled:opacity-50 active:bg-[#fb923c]/85 transition-colors"
              >
                Δημιουργία & Προσθήκη
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
