"use client";

import React, { useEffect, useState } from "react";
import { X, Save, Loader2 } from "lucide-react";
import type { PlayerRow as Player, PlayerStatisticsRow as PlayerStat } from "@/app/lib/types";

// The API returns a player joined with optional statistics.
// We extend the shared Player type locally so TS allows `player_statistics`.
type PlayerWithStats = Player & { player_statistics?: PlayerStat[] };

export interface PlayerBoardProps {
  open: boolean;
  playerId: number | null;
  onClose: () => void;
  onSaved: (player: Player) => void;
}

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

export default function PlayerBoard({ open, playerId, onClose, onSaved }: PlayerBoardProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState<number | "" | null>(null);
  const [goals, setGoals] = useState(0);
  const [assists, setAssists] = useState(0);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" ? onClose() : undefined);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Load when opened + id present
  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!open || !playerId) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/players/${playerId}`, { credentials: "include" });
        const data = (await safeJson(res)) ?? {};
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

        if (ignore) return;
        const p = data.player as PlayerWithStats;
        const s: PlayerStat =
          (p.player_statistics?.[0] as PlayerStat | undefined) ?? {
            id: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            yellow_cards: 0,
            red_cards: 0,
            age: null,
            total_goals: 0,
            total_assists: 0,
            blue_cards: 0,
          };

        setFirstName(p.first_name);
        setLastName(p.last_name);
        setAge(s.age ?? "");
        setGoals(s.total_goals ?? 0);
        setAssists(s.total_assists ?? 0);
      } catch (e: any) {
        if (!ignore) setError(e?.message ?? String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [open, playerId]);

  async function save() {
    if (!playerId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          age: age === "" ? null : age,
          total_goals: goals,
          total_assists: assists,
        }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      onSaved(data.player as Player);
      onClose();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`} aria-hidden={!open}>
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] bg-zinc-950 border-l border-white/10 shadow-2xl
                    transition-transform ${open ? "translate-x-0" : "translate-x-full"}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">Edit Player</h3>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10" title="Close">
            <X className="h-5 w-5 text-white/80" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <p className="text-white/70 inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading…
            </p>
          ) : error ? (
            <p className="text-red-400">Error: {error}</p>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-white/80">First name</span>
                  <input
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-white/80">Last name</span>
                  <input
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
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

                <div />
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-white/80">Total goals</span>
                  <input
                    type="number"
                    min={0}
                    value={goals}
                    onChange={(e) => setGoals(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-sm text-white/80">Total assists</span>
                  <input
                    type="number"
                    min={0}
                    value={assists}
                    onChange={(e) => setAssists(Number(e.target.value))}
                    className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  disabled={saving || !firstName.trim() || !lastName.trim() || goals < 0 || assists < 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
