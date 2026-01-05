//components/DashboardPageComponents/teams/AddPlayerToTeamModal.tsx
"use client";

import React, { useEffect, useMemo, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Search, Plus, UserPlus, Loader2 } from "lucide-react";
import type { PlayerRow as Player } from "@/app/lib/types";
import { safeJson } from "./teamHelpers";
import PlayerPhoto from "../players/PlayerPhoto";

// Το τρέχον bucket id
const BUCKET = "GPSarchive's Project";

// Βοηθητική για να δημιουργούμε ασφαλές slug φακέλου
function slugify(input: string) {
  return input
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function UploadButton({
  onUploaded,
  dirName,
}: {
  onUploaded: (path: string) => void;
  dirName: string;
}) {
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
      const res = await fetch("/api/storage/signed-upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          contentType: file.type,
          bucket: BUCKET,
          dirName,
        }),
      });
      const { signedUrl, path, error } = await res.json();
      if (!res.ok) throw new Error(error || "Αποτυχία λήψης υπογεγραμμένου URL μεταφόρτωσης");

      const putRes = await fetch(signedUrl, {
        method: "PUT",
        body: file,
        headers: { "content-type": file.type },
      });
      if (!putRes.ok) throw new Error("Αποτυχία μεταφόρτωσης αρχείου");

      onUploaded(path);
    } catch (err: any) {
      alert(err?.message ?? "Σφάλμα μεταφόρτωσης");
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        onChange={onChange}
        accept="image/*"
        className="hidden"
      />
      <button
        type="button"
        disabled={uploading}
        onClick={pickFile}
        className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded border border-white/10 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Choose file"}
      </button>
    </>
  );
}

export default function AddPlayerToTeamModal({
  open,
  teamId,
  onAdded,   // (playerId: number) => void
  onClose,
}: {
  open: boolean;
  teamId: number | null;
  onAdded: (playerId: number) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"existing" | "create">("existing");

  // Existing search
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const canSearch = open && Number.isFinite(teamId ?? NaN);

  useEffect(() => {
    if (!canSearch) return;
    let abort = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = new URL(`/api/players`, location.origin);
        url.searchParams.set("limit", "25");
        url.searchParams.set("excludeTeamId", String(teamId));
        if (q.trim()) url.searchParams.set("q", q.trim());
        const res = await fetch(url, { credentials: "include" });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        if (!abort) setPlayers(body?.players ?? []);
      } catch (e) {
        if (!abort) setPlayers([]);
      } finally {
        if (!abort) setLoading(false);
      }
    }, 300);
    return () => { abort = true; clearTimeout(t); };
  }, [q, canSearch, teamId]);

  // Create form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState<string>("");
  const [goals, setGoals] = useState<string>("0");
  const [assists, setAssists] = useState<string>("0");

  // Extended player profile fields
  const [photo, setPhoto] = useState<string>("");
  const [height, setHeight] = useState<string>("");
  const [position, setPosition] = useState<string>("");
  const [birth, setBirth] = useState<string>("");
  const [playerNumber, setPlayerNumber] = useState<string>("");

  // Card statistics
  const [yellowCards, setYellowCards] = useState<string>("0");
  const [redCards, setRedCards] = useState<string>("0");
  const [blueCards, setBlueCards] = useState<string>("0");

  const [saving, setSaving] = useState(false);

  // Generate directory name for photo uploads
  const dirName = useMemo(() => {
    if (!firstName.trim() || !lastName.trim()) return "";
    const stub = slugify(`${firstName} ${lastName}`);
    return `players/${stub}`;
  }, [firstName, lastName]);

  useEffect(() => {
    if (!open) {
      setTab("existing");
      setQ("");
      setPlayers([]);
      setFirstName("");
      setLastName("");
      setAge("");
      setGoals("0");
      setAssists("0");
      setPhoto("");
      setHeight("");
      setPosition("");
      setBirth("");
      setPlayerNumber("");
      setYellowCards("0");
      setRedCards("0");
      setBlueCards("0");
    }
  }, [open]);

  async function linkExisting(pid: number) {
    if (!teamId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ player_id: pid }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      onAdded(pid);
      onClose();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  async function createAndLink() {
    if (!teamId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          age: age === "" ? null : Number(age),
          total_goals: Number(goals || 0),
          total_assists: Number(assists || 0),
          // Extended player profile fields
          photo: photo.trim() || null,
          height_cm: height === "" ? null : Number(height),
          position: position.trim() || null,
          birth_date: birth || null,
          player_number: playerNumber === "" ? null : Number(playerNumber),
          // Card statistics
          yellow_cards: Number(yellowCards || 0),
          red_cards: Number(redCards || 0),
          blue_cards: Number(blueCards || 0),
        }),
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      onAdded(Number(body?.player_id));
      onClose();
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return typeof window !== 'undefined' && createPortal(
    <div className={`fixed inset-0 z-50 transition ${open ? "pointer-events-auto" : "pointer-events-none"}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${open ? "opacity-100" : "opacity-0"}`} onClick={onClose} />
      <div className={`absolute right-0 top-0 h-full w-full sm:w-[520px] bg-zinc-950/95 backdrop-blur border-l border-white/10 shadow-2xl transition-transform ${open ? "translate-x-0" : "translate-x-full"} flex flex-col`}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
          <h3 className="text-white font-semibold">Add player to team</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5" /></button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pt-3">
          <div className="inline-flex rounded-lg border border-white/10 overflow-hidden mb-4">
            <button onClick={() => setTab("existing")} className={`px-3 py-1.5 text-sm ${tab==="existing"?"bg-white/10":""}`}>Add existing</button>
            <button onClick={() => setTab("create")} className={`px-3 py-1.5 text-sm ${tab==="create"?"bg-white/10":""}`}>Create & add</button>
          </div>

          {tab === "existing" ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-white/50" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search by name…"
                    className="w-full pl-8 pr-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="min-h-[180px] border border-white/10 rounded-lg overflow-hidden">
                {loading ? (
                  <div className="p-4 text-white/80 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
                ) : players.length === 0 ? (
                  <div className="p-4 text-white/60">No matching players.</div>
                ) : (
                  <ul className="divide-y divide-white/10">
                    {players.map((p) => (
                      <li key={p.id} className="flex items-center justify-between px-3 py-2">
                        <span className="text-white">{p.first_name} {p.last_name}</span>
                        <button
                          disabled={saving}
                          onClick={() => linkExisting(p.id)}
                          className="inline-flex items-center gap-1 text-sm px-2 py-1 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-60"
                        >
                          <UserPlus className="w-4 h-4" /> Add
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <div className="max-h-[60vh] overflow-y-auto pr-2">
              <div className="grid sm:grid-cols-2 gap-3">
                {/* Basic Info */}
                <div>
                  <label className="block text-xs text-white/60 mb-1">First name *</label>
                  <input value={firstName} onChange={(e)=>setFirstName(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Last name *</label>
                  <input value={lastName} onChange={(e)=>setLastName(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>

                {/* Statistics */}
                <div>
                  <label className="block text-xs text-white/60 mb-1">Age (optional)</label>
                  <input type="number" value={age} onChange={(e)=>setAge(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Player Number</label>
                  <input type="number" value={playerNumber} onChange={(e)=>setPlayerNumber(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" placeholder="e.g. 10" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Goals</label>
                  <input type="number" value={goals} onChange={(e)=>setGoals(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Assists</label>
                  <input type="number" value={assists} onChange={(e)=>setAssists(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>

                {/* Extended Player Profile */}
                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1">Photo</label>
                  {photo ? (
                    <div className="mb-2">
                      <PlayerPhoto bucket={BUCKET} path={photo} alt={`${firstName} ${lastName}`.trim() || "Player photo"} />
                    </div>
                  ) : null}
                  <input
                    value={photo}
                    onChange={(e) => setPhoto(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white mb-2"
                    placeholder="Photo path"
                  />
                  {dirName && <UploadButton onUploaded={(path) => setPhoto(path)} dirName={dirName} />}
                </div>

                <div>
                  <label className="block text-xs text-white/60 mb-1">Height (cm)</label>
                  <input type="number" value={height} onChange={(e)=>setHeight(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" placeholder="e.g. 180" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Position</label>
                  <input value={position} onChange={(e)=>setPosition(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" placeholder="e.g. RW, CF" />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs text-white/60 mb-1">Birth Date</label>
                  <input type="date" value={birth} onChange={(e)=>setBirth(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>

                {/* Card Statistics */}
                <div>
                  <label className="block text-xs text-white/60 mb-1">Yellow Cards</label>
                  <input type="number" value={yellowCards} onChange={(e)=>setYellowCards(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Red Cards</label>
                  <input type="number" value={redCards} onChange={(e)=>setRedCards(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>
                <div>
                  <label className="block text-xs text-white/60 mb-1">Blue Cards</label>
                  <input type="number" value={blueCards} onChange={(e)=>setBlueCards(e.target.value)} className="w-full px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-white" />
                </div>

                <div className="sm:col-span-2 flex justify-end mt-1">
                  <button
                    disabled={saving || !firstName.trim() || !lastName.trim()}
                    onClick={createAndLink}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" /> {saving ? "Saving…" : "Create & add"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/10 flex justify-end shrink-0">
          <button onClick={onClose} className="px-3 py-2 text-sm rounded-lg hover:bg-white/10">Close</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
