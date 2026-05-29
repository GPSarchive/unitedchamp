// src/app/dashboard/preview/teams-v2/MobileTeamEditorSheet.tsx
"use client";

import { memo, useEffect, useMemo, useRef, useState } from "react";
import { X, Upload, Droplet, Scissors } from "lucide-react";
import type { TeamRow } from "@/app/lib/types";
import { isStoragePath, isUrl, safeJson, signIfNeeded } from "../../teams/teamHelpers";
import ConfirmLogoModal from "../../teams/ConfirmLogoModal";
import {
  extractColorFromImageFile,
  extractColorFromImageElement,
  extractColorFromImageUrl,
} from "@/app/lib/colorExtraction";

type Props = {
  initial: (Partial<TeamRow> & { id?: number }) | null;
  onClose: () => void;
  /** Called when the user explicitly saves; should close the editor. */
  onSaved: (saved: TeamRow) => void;
  /** Called after auto-save flows (logo upload, color extraction, trim). Should NOT close. */
  onAutoSaved?: (saved: TeamRow) => void;
};

function MobileTeamEditorSheetComponent({ initial, onClose, onSaved, onAutoSaved }: Props) {
  const [mounted, setMounted] = useState(false);
  const isEdit = !!initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [am, setAm] = useState<string>(((initial as any)?.am as string) ?? "");
  const [seasonScore, setSeasonScore] = useState<string>(
    (initial as any)?.season_score != null ? String((initial as any).season_score) : ""
  );
  const [logo, setLogo] = useState<string>(initial?.logo ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [colour, setColour] = useState<string>(((initial as any)?.colour as string) ?? "");

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [trimming, setTrimming] = useState(false);
  const [trimResult, setTrimResult] = useState<string | null>(null);

  // Confirm-upload modal
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  const previewImgRef = useRef<HTMLImageElement>(null);

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

  const validationError = useMemo(() => {
    if (!name.trim()) return "Όνομα υποχρεωτικό";
    if (name.trim().length < 2) return "Όνομα τουλάχιστον 2 χαρακτήρες";
    if (am && am.length > 64) return "ΑΜ έως 64 χαρακτήρες";
    if (seasonScore !== "" && !Number.isInteger(Number(seasonScore))) {
      return "Σκορ σεζόν: μη αρνητικός ακέραιος";
    }
    if (seasonScore !== "" && Number(seasonScore) < 0) {
      return "Σκορ σεζόν: μη αρνητικός ακέραιος";
    }
    const v = logo.trim();
    if (v && !isUrl(v) && !isStoragePath(v)) {
      return "Λογότυπο: https URL ή teams/<id>/file.ext";
    }
    return null;
  }, [name, am, seasonScore, logo]);

  function pickFile(file: File) {
    setPendingFile(file);
    setShowConfirm(true);
  }

  async function actuallyUpload(file: File) {
    setShowConfirm(false);
    setPendingFile(null);
    setUploading(true);
    let uploadedUrl: string | null = null;
    let extractedColour: string | null = null;
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("team", name || "team");
      const res = await fetch("/api/teams/logo-upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      uploadedUrl = body.publicUrl as string;
      setLogo(uploadedUrl);
      setPreview(uploadedUrl);

      // auto-extract color from the file directly (safer than waiting on signed URL)
      try {
        extractedColour = await extractColorFromImageFile(file);
        setColour(extractedColour);
      } catch (err) {
        console.warn("Color extraction failed:", err);
      }

      // Auto-save when editing existing team (keeps editor open)
      if (isEdit && initial?.id && uploadedUrl) {
        const patchBody: Record<string, any> = { logo: uploadedUrl };
        if (extractedColour) patchBody.colour = extractedColour;
        const res2 = await fetch(`/api/teams/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(patchBody),
        });
        const body2 = await safeJson(res2);
        if (!res2.ok) throw new Error(body2?.error || `HTTP ${res2.status}`);
        const saved = body2.team as TeamRow;
        const mapped = await signIfNeeded(saved.logo ?? null);
        setPreview(mapped ?? saved.logo ?? uploadedUrl);
        onAutoSaved?.(saved);
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setUploading(false);
    }
  }

  async function extractColorFromCurrentLogo() {
    setExtracting(true);
    try {
      let colourHex: string;
      const img = previewImgRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        try {
          colourHex = extractColorFromImageElement(img);
        } catch (err: any) {
          if (preview) {
            colourHex = await extractColorFromImageUrl(preview);
          } else {
            throw err;
          }
        }
      } else if (preview) {
        colourHex = await extractColorFromImageUrl(preview);
      } else {
        throw new Error("Δεν υπάρχει λογότυπο για εξαγωγή χρώματος.");
      }
      setColour(colourHex);

      // Auto-save extracted colour when editing existing team (keeps editor open)
      if (isEdit && initial?.id) {
        const res = await fetch(`/api/teams/${initial.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ colour: colourHex }),
        });
        const body = await safeJson(res);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        onAutoSaved?.(body.team as TeamRow);
      }
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setExtracting(false);
    }
  }

  async function trimLogo() {
    if (!isEdit || !initial?.id) return;
    setTrimming(true);
    setTrimResult(null);
    try {
      const res = await fetch(`/api/teams/${initial.id}/trim-logo`, {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json();
      if (!res.ok) {
        setTrimResult(`✗ ${body?.error || "Αποτυχία"}`);
        return;
      }
      if (body.trimmed) {
        setTrimResult(
          `✓ ${body.before.width}×${body.before.height} → ${body.after.width}×${body.after.height}`
        );
        // refresh preview via cache-busted re-sign
        const mapped = await signIfNeeded(logo || null);
        if (mapped) setPreview(`${mapped}${mapped.includes("?") ? "&" : "?"}_=${Date.now()}`);
      } else {
        setTrimResult("✓ Δεν χρειάστηκε");
      }
    } catch (err: any) {
      setTrimResult(`✗ ${err?.message || "Σφάλμα"}`);
    } finally {
      setTrimming(false);
    }
  }

  async function save() {
    if (validationError) return;
    setSaving(true);
    try {
      let logoForSave: string | null = null;
      const v = logo.trim();
      if (v) {
        if (isUrl(v) || isStoragePath(v)) logoForSave = v;
      }

      const payload: Record<string, any> = {
        name: name.trim(),
        logo: logoForSave,
        am: am.trim() || null,
        colour: colour.trim() || null,
      };
      if (seasonScore !== "") payload.season_score = Number(seasonScore);

      const res = await fetch(isEdit ? `/api/teams/${initial!.id}` : "/api/teams", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) {
        const msg = body?.error || `HTTP ${res.status}`;
        if (/duplicate key.*am/i.test(String(msg))) {
          throw new Error("Το ΑΜ υπάρχει ήδη.");
        }
        throw new Error(msg);
      }
      onSaved(body.team as TeamRow);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    } finally {
      setSaving(false);
    }
  }

  const hasLogo = !!logo.trim();

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
        aria-label={isEdit ? "Επεξεργασία ομάδας" : "Νέα ομάδα"}
        className={`absolute inset-x-0 bottom-0 top-[6vh] sm:top-auto sm:bottom-4 sm:right-4 sm:left-auto sm:w-[520px] sm:max-h-[calc(100vh-2rem)] sm:rounded-2xl flex flex-col
          bg-zinc-950 border border-white/10 shadow-2xl rounded-t-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-white/20" />
        </div>

        <div className="px-4 pt-3 pb-3 flex items-center justify-between border-b border-white/10 shrink-0">
          <h3 className="text-sm font-semibold text-white">
            {isEdit ? "Επεξεργασία ομάδας" : "Νέα ομάδα"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/55 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <div className="flex items-center gap-3">
            <div
              className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-zinc-900 grid place-items-center"
              style={{ borderColor: colour || "rgba(255,255,255,0.1)" }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  ref={previewImgRef}
                  alt="logo"
                  src={preview}
                  crossOrigin="anonymous"
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-[10px] text-white/30">No logo</span>
              )}
            </div>
            <label className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-zinc-900 px-3 py-3 text-sm text-white/80 hover:bg-zinc-800 transition-colors cursor-pointer">
              <Upload className="h-4 w-4" />
              {uploading ? "Ανέβασμα…" : "Ανέβασμα λογότυπου"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) pickFile(f);
                }}
                disabled={uploading}
              />
            </label>
          </div>

          {hasLogo && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={extractColorFromCurrentLogo}
                disabled={extracting || !preview}
                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs text-white/80 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
              >
                <Droplet className="h-3.5 w-3.5" />
                {extracting ? "Εξαγωγή…" : "Εξαγωγή χρώματος"}
              </button>
              {isEdit && (
                <button
                  type="button"
                  onClick={trimLogo}
                  disabled={trimming}
                  className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-zinc-900 px-2.5 py-1.5 text-xs text-white/80 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
                >
                  <Scissors className="h-3.5 w-3.5" />
                  {trimming ? "Trim…" : "Trim λογότυπου"}
                </button>
              )}
              {trimResult && (
                <span className="text-xs text-white/55">{trimResult}</span>
              )}
            </div>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Όνομα *</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Athens City FC"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">ΑΜ</span>
              <input
                value={am}
                onChange={(e) => setAm(e.target.value)}
                placeholder="AM-12345"
                className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-white/55">Σκορ σεζόν</span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={seasonScore}
                onChange={(e) => setSeasonScore(e.target.value)}
                placeholder="0"
                className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">
              Λογότυπο (URL ή διαδρομή)
            </span>
            <input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://… ή teams/<id>/file.png"
              className="rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-white/55">Χρώμα ομάδας</span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colour || "#3b82f6"}
                onChange={(e) => setColour(e.target.value)}
                className="h-10 w-12 shrink-0 rounded-lg border border-white/15 bg-zinc-900 cursor-pointer"
                aria-label="Επιλογέας χρώματος"
              />
              <input
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                placeholder="#3b82f6"
                maxLength={7}
                className="flex-1 rounded-lg border border-white/15 bg-zinc-900 px-3 py-2.5 font-mono text-xs text-white placeholder:text-white/30 focus:border-white/30 focus:outline-none focus:ring-1 focus:ring-white/20 transition-colors"
              />
            </div>
          </label>

          {validationError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {validationError}
            </p>
          )}
        </div>

        <div className="px-4 pt-3 pb-4 border-t border-white/10 flex gap-2 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 bg-zinc-900 py-2.5 text-sm text-white/80 hover:bg-zinc-800 transition-colors"
          >
            Ακύρωση
          </button>
          <button
            onClick={save}
            disabled={!!validationError || saving}
            className="flex-1 rounded-lg border border-blue-500/50 bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
          >
            {saving ? "Αποθήκευση…" : isEdit ? "Αποθήκευση" : "Δημιουργία"}
          </button>
        </div>
      </div>

      {pendingFile && (
        <ConfirmLogoModal
          file={pendingFile}
          open={showConfirm}
          onCancel={() => {
            setShowConfirm(false);
            setPendingFile(null);
          }}
          onConfirm={(f) => actuallyUpload(f)}
        />
      )}
    </div>
  );
}

const MobileTeamEditorSheet = memo(MobileTeamEditorSheetComponent);
export default MobileTeamEditorSheet;
