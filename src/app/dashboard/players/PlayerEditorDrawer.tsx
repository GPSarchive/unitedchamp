"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { clsx } from "../teams/teamHelpers";
import type { PlayerWithStats, PlayerFormPayload } from "./types";
import PlayerPhoto from "./PlayerPhoto";

type Props = {
  open: boolean;
  onClose: () => void;
  player: PlayerWithStats | null; // if null => create
  onSubmit: (payload: PlayerFormPayload) => Promise<void> | void;
};

// Use your actual bucket ID (the one that currently works for teams)
const BUCKET = "GPSarchive's Project";

function UploadButton({ onUploaded }: { onUploaded: (path: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    inputRef.current?.click();
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      // 1) Ask the server for a signed upload URL (admin-only route)
      const res = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contentType: file.type,
          bucket: BUCKET, // pass your bucket (private)
        }),
      });
      const { signedUrl, path, error } = await res.json();
      if (!res.ok) throw new Error(error || "Failed to get signed upload URL");

      // 2) Upload the file directly to Storage using the signed URL
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "x-upsert": "false", "content-type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("Upload failed");

      // 3) Private bucket: store the STORAGE PATH (e.g. "players/uuid.jpg")
      onUploaded(path);
    } catch (err: any) {
      alert(err?.message || String(err));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={pickFile}
        className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800 disabled:opacity-60"
      >
        {uploading ? "Uploading…" : "Upload"}
      </button>
    </>
  );
}

export default function PlayerEditorDrawer({ open, onClose, player, onSubmit }: Props) {
  const isEdit = !!player?.id;
  const s = player?.player_statistics?.[0];

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<string>("");
  const [goals, setGoals] = useState<string>("");
  const [assists, setAssists] = useState<string>("");

  // NEW fields
  const [photo, setPhoto] = useState(""); // will hold STORAGE PATH for private bucket
  const [height, setHeight] = useState("");
  const [position, setPosition] = useState("");
  const [birth, setBirth] = useState("");
  const [yc, setYC] = useState("");
  const [rc, setRC] = useState("");
  const [bc, setBC] = useState("");

  useEffect(() => {
    if (!open) return;

    // Core identity
    setFirst(player?.first_name ?? "");
    setLast(player?.last_name ?? "");

    // Core stats (come from player_statistics[0], not the top-level)
    setAge(s?.age == null ? "" : String(s.age));
    setGoals(s?.total_goals == null ? "" : String(s.total_goals));
    setAssists(s?.total_assists == null ? "" : String(s.total_assists));

    // Extended player fields (on the player row)
    setPhoto(player?.photo ?? ""); // storage path when using private bucket
    setHeight(player?.height_cm == null ? "" : String(player.height_cm));
    setPosition(player?.position ?? "");
    setBirth(player?.birth_date ? String(player.birth_date).slice(0, 10) : "");

    // Card counters (also in stats row)
    setYC(s?.yellow_cards == null ? "" : String(s.yellow_cards));
    setRC(s?.red_cards == null ? "" : String(s.red_cards));
    setBC(s?.blue_cards == null ? "" : String(s.blue_cards));
  }, [open, player?.id]);

  const valid = useMemo(() => first.trim() && last.trim(), [first, last]);

  async function handleSave() {
    if (!valid) return;

    const payload: PlayerFormPayload = {
      first_name: first.trim(),
      last_name: last.trim(),
      age: age === "" ? null : Number(age),
      total_goals: goals === "" ? 0 : Number(goals),
      total_assists: assists === "" ? 0 : Number(assists),

      // NEW fields
      photo: photo.trim() || null, // STORAGE PATH (private bucket)
      height_cm: height === "" ? null : Number(height),
      position: position.trim() || null,
      birth_date: birth ? new Date(birth).toISOString() : null,

      // Stats counters
      yellow_cards: yc === "" ? 0 : Number(yc),
      red_cards: rc === "" ? 0 : Number(rc),
      blue_cards: bc === "" ? 0 : Number(bc),
    };

    await onSubmit(payload);
    onClose();
  }

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 transition",
        open ? "pointer-events-auto" : "pointer-events-none"
      )}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <div
        className={clsx(
          "absolute inset-0 bg-black/50 transition-opacity",
          open ? "opacity-100" : "opacity-0"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={clsx(
          "absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950/95 backdrop-blur border-l border-white/10 shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="font-semibold text-white">
            {isEdit ? "Edit player" : "Create player"}
          </div>
          <button
            onClick={onClose}
            className="px-2 py-1 rounded-lg bg-zinc-900 text-white border border-white/10"
          >
            Close
          </button>
        </div>

        {/* Body */}
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Names */}
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

          {/* Core stats */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Age</span>
            <input
              value={age}
              onChange={(e) => setAge(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="e.g. 23"
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

          {/* Extended bio & meta */}
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="text-sm text-white/80">Photo</span>

            {/* preview via signed URL (private bucket) */}
            {photo ? (
              <PlayerPhoto
                bucket={BUCKET}
                path={photo} // storage path like "players/uuid.jpg"
                alt="Preview"
                className="h-24 w-24 object-cover rounded-lg border border-white/10 mb-2"
              />
            ) : null}

            <div className="flex items-center gap-2">
              <input
                value={photo}
                onChange={(e) => setPhoto(e.target.value)}
                className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
                placeholder="players/uuid.jpg"
              />
              <UploadButton onUploaded={(path) => setPhoto(path)} />
            </div>

            <p className="text-xs text-white/50">
              Private bucket: we store the <span className="font-mono">players/&lt;uuid&gt;.ext</span> path and sign it for display.
            </p>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Height (cm)</span>
            <input
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="e.g. 178"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Position</span>
            <input
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="e.g. RW"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Birth date</span>
            <input
              type="date"
              value={birth}
              onChange={(e) => setBirth(e.target.value)}
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            />
          </label>

          {/* Cards */}
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Yellow cards</span>
            <input
              value={yc}
              onChange={(e) => setYC(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Red cards</span>
            <input
              value={rc}
              onChange={(e) => setRC(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="0"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm text-white/80">Blue cards</span>
            <input
              value={bc}
              onChange={(e) => setBC(e.target.value)}
              inputMode="numeric"
              className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="0"
            />
          </label>

          {/* Actions */}
          <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-lg border border-white/15 text-white bg-transparent hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!valid}
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
