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

  // form state
  const [name, setName] = useState(initial?.name ?? "");
  const [logo, setLogo] = useState<string>(initial?.logo ?? ""); // https URL or storage path
  const [preview, setPreview] = useState<string | null>(null);

  // NEW: AM (text, optional; unique)
  const [am, setAm] = useState<string>(
    typeof (initial as any)?.am === "string" ? (initial as any).am : ""
  );

  // NEW: season_score (non-negative integer). Allow empty '' while typing.
  const initialSeasonScore =
    typeof (initial as any)?.season_score === "number" ? (initial as any).season_score : "";
  const [seasonScore, setSeasonScore] = useState<number | "">(initialSeasonScore);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // modal state for confirm
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  // map logo to preview: if it's a storage path → proxy, else use as-is
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const v = logo?.trim();
      const url = await signIfNeeded(v || null);
      if (cancelled) return;
      setPreview(url);
    })();
    return () => {
      cancelled = true;
    };
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

      // NEW: auto-save logo into DB when editing an existing team
      if (isEdit && initial?.id) {
        setSaving(true);
        try {
          const res2 = await fetch(`/api/teams/${initial.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ logo: body.publicUrl }),
          });
          const body2 = await safeJson(res2);
          if (!res2.ok) throw new Error(body2?.error || `HTTP ${res2.status}`);

          let saved = (body2 as any).team as TeamRow;

          // Update preview in case the API normalized the logo value
          const mapped = await signIfNeeded(saved.logo ?? null);
          setPreview(mapped ?? saved.logo ?? (body.publicUrl as string));

          // Notify parent so lists refresh
          onSaved(saved);
        } catch (e: any) {
          console.error(e);
          alert(e?.message ?? String(e));
        } finally {
          setSaving(false);
        }
      }
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
      let logoForSave: string | null = null;
      const v = logo.trim();
      if (v) {
        if (isUrl(v)) {
          logoForSave = v; // https ok
        } else if (isStoragePath(v)) {
          logoForSave = v; // <-- send raw storage path (fix)
        }
      }

      const payload: Record<string, any> = {
        name: name.trim(),
        logo: logoForSave,
        am: am.trim() || null,
      };
      if (seasonScore !== "") payload.season_score = seasonScore;

      const res = await fetch(isEdit ? `/api/teams/${initial!.id}` : "/api/teams", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const body = await safeJson(res);

      if (!res.ok) {
        const msg = body?.error || `HTTP ${res.status}`;
        // provide friendlier messages for common issues
        if (/duplicate key.*am/i.test(String(msg))) {
          throw new Error("Το ΑΜ υπάρχει ήδη σε άλλη ομάδα.");
        }
        if (/Invalid logo path/i.test(String(msg))) throw new Error("Μη έγκυρη διαδρομή λογότυπου (χρησιμοποίησε https URL ή teams/<id>/...).");
        throw new Error(msg);
      }

      let saved = (body as any).team as TeamRow;

      // keep preview in sync with saved value
      const mapped = await signIfNeeded(saved.logo ?? null);
      saved = { ...saved, logo: mapped ?? saved.logo };

      onSaved(saved);
    } catch (err: any) {
      alert(err?.message ?? String(err));
    } finally {
      setSaving(false);
    }
  }
  

  const validationError = useMemo(() => {
    if (!name.trim()) return "Name is required";
    if (name.trim().length < 2) return "Name must be at least 2 characters";

    // AM: cap length (adjust if you want stricter rules/regex)
    if (am && am.length > 64) return "AM must be at most 64 characters";

    // season_score: must be non-negative integer when provided
    if (seasonScore !== "" && (!Number.isInteger(seasonScore) || seasonScore < 0)) {
      return "Season score must be a non-negative integer";
    }

    const v = logo.trim();
    if (v) {
      // Only allow https URLs or storage paths (e.g., teams/<id>/file.png)
      if (!isUrl(v) && !isStoragePath(v)) {
        return "Logo must be an https URL or a storage path like teams/<id>/file.png";
      }
    }

    return null;
  }, [name, logo, am, seasonScore]);

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

        {/* AM */}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">ΑΜ</span>
          <input
            value={am}
            onChange={(e) => setAm(e.target.value)}
            className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10"
            placeholder="e.g. AM-12345"
          />
        </label>

        {/* Logo (text input) */}
        <label className="flex flex-col gap-1">
          <span className="text-sm text-white/80">Logo (URL or storage path)</span>
          <input
            value={logo}
            onChange={(e) => setLogo(e.target.value)}
            className={clsx(
              "px-3 py-2 rounded-lg bg-zinc-900 text-white border",
              validationError?.toLowerCase().includes("logo")
                ? "border-red-500/40"
                : "border-white/10"
            )}
            placeholder="https://… or folder/file.png"
          />
        </label>
      </div>

      {/* Logo picker + preview */}
      <div className="flex items-center gap-3">
        <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-white/15 bg-zinc-900">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt="logo preview"
              src={preview}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center text-xs text-white/40">
              No logo
            </div>
          )}
        </div>

        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-white/15 hover:bg-white/5 cursor-pointer">
          <span>{uploading ? "Uploading…" : "Upload"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={onPick}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 rounded-lg border border-white/15 text-white/80 hover:bg-white/5"
          disabled={saving || uploading}
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
