// src/app/dashboard/preview/teams-v2/MobileTeamEditorSheet.tsx
"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { X, Upload } from "lucide-react";
import type { TeamRow } from "@/app/lib/types";
import { isStoragePath, isUrl, safeJson, signIfNeeded } from "../../teams/teamHelpers";

type Props = {
  initial: (Partial<TeamRow> & { id?: number }) | null;
  onClose: () => void;
  onSaved: (saved: TeamRow) => void;
};

function MobileTeamEditorSheetComponent({ initial, onClose, onSaved }: Props) {
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

  async function uploadLogo(file: File) {
    setUploading(true);
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
      const url = body.publicUrl as string;
      setLogo(url);
      setPreview(url);
    } catch (e: any) {
      alert(e?.message ?? String(e));
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
                <img alt="logo" src={preview} className="h-full w-full object-contain" />
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
                  if (f) uploadLogo(f);
                }}
                disabled={uploading}
              />
            </label>
          </div>

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
    </div>
  );
}

const MobileTeamEditorSheet = memo(MobileTeamEditorSheetComponent);
export default MobileTeamEditorSheet;
