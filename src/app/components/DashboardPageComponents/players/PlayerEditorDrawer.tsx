"use client";

import React, { useEffect, useMemo, useState } from "react";
import { clsx } from "@/app/components/DashboardPageComponents/teams/teamHelpers";
import type { PlayerWithStats, PlayerFormPayload } from "./types";

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerWithStats | null;     // if null => create
  onSubmit: (payload: PlayerFormPayload) => Promise<void> | void;
};

export default function PlayerEditorDrawer({ open, onClose, player, onSubmit }: Props) {
  const isEdit = !!player?.id;
  const s = player?.player_statistics?.[0];

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<string>("");
  const [goals, setGoals] = useState<string>("");
  const [assists, setAssists] = useState<string>("");

  useEffect(() => {
    if (!open) return;
    setFirst(player?.first_name ?? "");
    setLast(player?.last_name ?? "");
    setAge(s?.age == null ? "" : String(s.age));
    setGoals(s?.total_goals == null ? "" : String(s.total_goals));
    setAssists(s?.total_assists == null ? "" : String(s.total_assists));
  }, [open, player?.id]); // reset when drawer opens or different player

  const valid = useMemo(() => first.trim() && last.trim(), [first, last]);

  async function handleSave() {
    if (!valid) return;
    const payload: PlayerFormPayload = {
      first_name: first.trim(),
      last_name: last.trim(),
      age: age === "" ? null : Number(age),
      total_goals: goals === "" ? 0 : Number(goals),
      total_assists: assists === "" ? 0 : Number(assists),
    };
    await onSubmit(payload);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950 border-l border-white/10 shadow-2xl">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h3 className="text-white font-semibold">{isEdit ? "Edit player" : "Create player"}</h3>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
          >
            Close
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="e.g. 24"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Total goals</span>
            <input
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Total assists</span>
            <input
              value={assists}
              onChange={(e) => setAssists(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="0"
            />
          </label>

          <div className="sm:col-span-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!valid}
              onClick={handleSave}
              className={clsx(
                "px-3 py-2 rounded-lg border text-white",
                valid
                  ? "border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                  : "border-white/15 bg-zinc-900 opacity-60"
              )}
            >
              {isEdit ? "Save changes" : "Create player"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
