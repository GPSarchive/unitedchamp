// src/app/dashboard/preview/teams-v2/MobileTeamEditorSheet.tsx
"use client";

import { memo, useEffect, useMemo, useState } from "react";
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
        className={`absolute inset-x-0 bottom-0 top-[8vh] flex flex-col
          bg-[#0a0a14] border-t-2 border-[#F3EFE6]/20 shadow-2xl
          transition-transform duration-200 ease-out
          ${mounted ? "translate-y-0" : "translate-y-full"}`}
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="h-1 w-10 rounded-full bg-[#F3EFE6]/30" />
        </div>

        <div className="px-4 pt-1 pb-3 flex items-center justify-between border-b border-[#F3EFE6]/10 shrink-0">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#F3EFE6]">
            {isEdit ? "Επεξεργασία" : "Νέα Ομάδα"}
          </h3>
          <button
            onClick={onClose}
            aria-label="Κλείσιμο"
            className="h-9 w-9 flex items-center justify-center text-[#F3EFE6]/60 active:text-[#F3EFE6]"
          >
            <span className="text-[18px] leading-none">✕</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Logo preview + upload */}
          <div className="flex items-center gap-3">
            <div
              className="relative h-16 w-16 shrink-0 overflow-hidden border-2 grid place-items-center"
              style={{ borderColor: colour || "rgba(243,239,230,0.2)", background: "#0a0a14" }}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  alt="logo"
                  src={preview}
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/40">
                  No logo
                </span>
              )}
            </div>
            <label className="flex-1 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/80 active:bg-[#1a1a26] transition-colors text-center cursor-pointer">
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
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Όνομα *
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. Athens City FC"
              className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-3 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                ΑΜ
              </span>
              <input
                value={am}
                onChange={(e) => setAm(e.target.value)}
                placeholder="π.χ. AM-12345"
                className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-3 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
                Σκορ σεζόν
              </span>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={seasonScore}
                onChange={(e) => setSeasonScore(e.target.value)}
                placeholder="0"
                className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-3 font-[var(--f-body)] text-sm text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Λογότυπο (URL ή διαδρομή)
            </span>
            <input
              value={logo}
              onChange={(e) => setLogo(e.target.value)}
              placeholder="https://… ή teams/<id>/file.png"
              className="border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-3 font-mono text-xs text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
              Χρώμα ομάδας
            </span>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={colour || "#fb923c"}
                onChange={(e) => setColour(e.target.value)}
                className="h-11 w-14 border-2 border-[#F3EFE6]/20 bg-[#0a0a14] cursor-pointer"
                aria-label="Επιλογέας χρώματος"
              />
              <input
                value={colour}
                onChange={(e) => setColour(e.target.value)}
                placeholder="#fb923c"
                maxLength={7}
                className="flex-1 border-2 border-[#F3EFE6]/20 bg-[#0a0a14] px-3 py-3 font-mono text-xs uppercase text-[#F3EFE6] focus:border-[#fb923c] focus:outline-none transition-colors"
              />
            </div>
          </label>

          {validationError && (
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-400">
              {validationError}
            </p>
          )}
        </div>

        {/* Footer actions */}
        <div className="px-4 pt-3 pb-4 border-t border-[#F3EFE6]/10 bg-[#0a0a14] shrink-0 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 border-2 border-[#F3EFE6]/20 bg-[#13131d] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#F3EFE6]/80 active:text-[#F3EFE6] transition-colors"
          >
            Ακύρωση
          </button>
          <button
            onClick={save}
            disabled={!!validationError || saving}
            className="flex-1 border-2 border-[#fb923c] bg-[#fb923c] py-3 font-mono text-[11px] uppercase tracking-[0.25em] text-[#0a0a14] disabled:opacity-50 active:bg-[#fb923c]/85 transition-colors"
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
