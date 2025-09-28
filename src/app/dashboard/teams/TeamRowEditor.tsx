// components/DashboardPageComponents/teams/TeamRowEditor.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { TeamRow } from "@/app/lib/types";
import { clsx, isStoragePath, isUrl, safeJson, signIfNeeded } from "./teamHelpers";
import ConfirmLogoModal from "./ConfirmLogoModal";

export default function TeamRowEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial?: Partial<TeamRow>;
  onCancel: () => void;
  onSaved: (saved: TeamRow) => void;
}) {
  const isEdit = Boolean(initial?.id);

  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState<string>(initial?.logo ?? ""); // https URL or storage path
  const [preview, setPreview] = useState<string | null>(null);

  // NEW: season_score (non-negative integer). Allow empty '' while typing.
  const initialSeasonScore =
    typeof (initial as any)?.season_score === "number" ? (initial as any).season_score : "";
  const [seasonScore, setSeasonScore] = useState<number | "">(initialSeasonScore);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // NEW: pending file & modal
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const validationError = useMemo(() => {
    if (!name.trim()) return "Name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";

    // season_score: must be non-negative integer when provided
    if (seasonScore !== "" && (!Number.isInteger(seasonScore) || seasonScore < 0)) {
      return "Season score must be a non-negative integer";
    }

    const v = logo.trim();
    if (!v) return null;
    if (!isUrl(v) && !isStoragePath(v)) {
      return "Logo must be a full https URL or a storage path like folder/file.png";
    }
    return null;
  }, [name, logo, seasonScore]);

  useEffect(() => {
    (async () => {
      const v = (initial?.logo ?? "").trim();
      if (!v) return setPreview(null);
      if (isUrl(v)) return setPreview(v);
      const mapped = await signIfNeeded(v);
      setPreview(mapped);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const v = logo.trim();
    if (!v) return setPreview(null);
    if (isUrl(v)) return setPreview(v);
    (async () => {
      if (!isStoragePath(v)) return setPreview(null);
      const mapped = await signIfNeeded(v);
      setPreview(mapped);
    })();
  }, [logo]);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPendingFile(f);
    setShowConfirm(true); // open modal first
    e.target.value = ""; // allow re-choosing same file later
  }

  async function actuallyUpload(file: File) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("team", name || "team");
      const res = await fetch("/api/teams/logo-upload", { method: "POST", body: fd, credentials: "include" });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // Store & preview the stable proxy URL from the uploader
      setLogo(body.publicUrl as string);
      setPreview((body.publicUrl as string) ?? null);
    } catch (err: any) {
      alert(err?.message ?? String(err));
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (validationError) return;
    setSaving(true);
    try {
      // Convert any typed storage path → stable proxy URL before sending
      let logoForSave: string | null = null;
      const v = logo.trim();
      if (v) {
        if (isUrl(v)) {
          logoForSave = v;
        } else if (isStoragePath(v)) {
          logoForSave = (await signIfNeeded(v)) ?? null;
        }
      }

      // Build payload
      const payload: Record<string, any> = {
        name: name.trim(),
        logo: logoForSave,
      };
      if (seasonScore !== "") payload.season_score = seasonScore;

      const res = await fetch(isEdit ? `/api/teams/${initial!.id}` : "/api/teams", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error((body && (body as any).error) || `HTTP ${res.status}`);

      let saved = (body as any).team as TeamRow;

      if (saved?.logo && !isUrl(saved.logo) && isStoragePath(saved.logo)) {
        const mapped = await signIfNeeded(saved.logo);
        saved = { ...saved, logo: mapped ?? saved.logo };
      }
      onSaved(saved);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-3 rounded-xl border border-white/15 bg-black/50 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Team name */}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Team name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            placeholder="e.g. Athens City FC"
          />
        </label>

        {/* Season score */}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Season score</span>
          <input
            type="number"
            min={0}
            value={seasonScore === "" ? "" : seasonScore}
            onChange={(e) => {
              const val = e.target.value;
              setSeasonScore(val === "" ? "" : Number(val));
            }}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            placeholder="e.g. 0"
          />
        </label>

        {/* Logo */}
        <label className="flex flex-col gap-1 md:col-span-2">
          <span className="text-sm text-white/80">Logo (URL or upload)</span>
          <div className="flex items-center gap-2">
            <input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              className="flex-1 px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
              placeholder="https://… or folder/file.png"
            />
            <label
              className={clsx(
                "px-3 py-2 rounded-lg border text-white cursor-pointer",
                uploading ? "border-white/20 bg-zinc-800 opacity-70" : "border-white/15 bg-zinc-900 hover:bg-zinc-800"
              )}
            >
              {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={onPick}
                disabled={uploading}
              />
            </label>
          </div>
          {preview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt="Logo preview"
              className="mt-2 h-12 w-12 object-contain rounded ring-1 ring-white/10"
            />
          )}
        </label>
      </div>

      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={!!validationError || saving}
          className="px-3 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50"
        >
          {saving ? "Saving…" : isEdit ? "Save" : "Create"}
        </button>
      </div>

      {validationError && <p className="text-red-400 text-sm">{validationError}</p>}

      {/* Confirm modal */}
      {pendingFile && (
        <ConfirmLogoModal
          file={pendingFile}
          open={showConfirm}
          onCancel={() => {
            setShowConfirm(false);
            setPendingFile(null);
          }}
          onConfirm={(f) => {
            setShowConfirm(false);
            actuallyUpload(f);
            setPendingFile(null);
          }}
        />
      )}
    </div>
  );
}
