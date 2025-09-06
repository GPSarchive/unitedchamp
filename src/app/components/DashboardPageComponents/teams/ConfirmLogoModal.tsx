"use client";

import React, { useEffect, useMemo, useState } from "react";
import { clsx } from "./teamHelpers";

type Props = {
  file: File;
  open: boolean;
  onConfirm: (file: File) => void;
  onCancel: () => void;
};

// Allowed types for logos (tweak as you prefer)
const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);

// Constraints (tweak as you prefer)
const MIN_W = 128;
const MIN_H = 128;
const MAX_W = 2048;
const MAX_H = 2048;

export default function ConfirmLogoModal({ file, open, onConfirm, onCancel }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [dims, setDims] = useState<{ w: number | null; h: number | null }>({ w: null, h: null });

  useEffect(() => {
    if (!open) return;
    const url = URL.createObjectURL(file);
    setObjectUrl(url);

    // Get dimensions for raster images
    if (file.type !== "image/svg+xml") {
      const img = new Image();
      img.onload = () => {
        setDims({ w: img.naturalWidth, h: img.naturalHeight });
      };
      img.onerror = () => setDims({ w: null, h: null });
      img.src = url;
    } else {
      setDims({ w: null, h: null }); // vector, dimensions not required
    }

    return () => {
      URL.revokeObjectURL(url);
      setObjectUrl(null);
    };
  }, [file, open]);

  const sizeLabel = useMemo(() => {
    const kb = file.size / 1024;
    return kb < 1024 ? `${kb.toFixed(0)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  }, [file.size]);

  const typeOk = ALLOWED.has(file.type);
  const dimsOk =
    file.type === "image/svg+xml" ||
    (dims.w !== null &&
      dims.h !== null &&
      dims.w >= MIN_W &&
      dims.h >= MIN_H &&
      dims.w <= MAX_W &&
      dims.h <= MAX_H);

  const warnings: string[] = [];
  if (file.type !== "image/svg+xml" && dims.w && dims.h) {
    const ratio = dims.w / dims.h;
    if (ratio < 0.75 || ratio > 1.33) warnings.push("Logo is not roughly square; it may look small or stretched.");
  }
  if (file.type === "image/jpeg") {
    warnings.push("JPEG has no transparency. Prefer PNG or WEBP for logos with transparent backgrounds.");
  }

  const canUpload = typeOk && dimsOk;

  return (
    <div
      className={clsx(
        "fixed inset-0 z-50 flex items-center justify-center transition",
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
      aria-hidden={!open}
    >
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-xl rounded-2xl bg-zinc-900 border border-white/10 p-5 shadow-xl">
        <h2 className="text-white text-lg font-semibold mb-3">Confirm logo upload</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center justify-center bg-black/40 rounded-xl p-4 min-h-[160px]">
            {objectUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={objectUrl}
                alt="Logo preview"
                className="max-h-40 max-w-full object-contain rounded ring-1 ring-white/10"
              />
            ) : (
              <div className="text-white/60 text-sm">Loading preview…</div>
            )}
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-white/60">File name</span>
              <span className="text-white">{file.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Type</span>
              <span className={clsx("px-2 py-0.5 rounded", typeOk ? "bg-emerald-700/30" : "bg-red-700/30", "text-white")}>
                {file.type || "unknown"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-white/60">Size</span>
              <span className="text-white">{sizeLabel}</span>
            </div>
            {file.type !== "image/svg+xml" && (
              <div className="flex items-center justify-between">
                <span className="text-white/60">Dimensions</span>
                <span className={clsx("text-white", dimsOk ? "" : "text-red-300")}>
                  {dims.w && dims.h ? `${dims.w} × ${dims.h}px` : "…"}
                </span>
              </div>
            )}

            <ul className="mt-2 space-y-1">
              {!typeOk && <li className="text-red-300">Unsupported type. Allowed: PNG, JPEG, WEBP, SVG.</li>}
              {!dimsOk && file.type !== "image/svg+xml" && (
                <li className="text-red-300">
                  Dimensions must be between {MIN_W}×{MIN_H} and {MAX_W}×{MAX_H}px.
                </li>
              )}
              {warnings.map((w, i) => (
                <li key={i} className="text-amber-300">{w}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-2 rounded-lg border border-white/15 text-white bg-zinc-900 hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm(file)}
            disabled={!canUpload}
            className={clsx(
              "px-3 py-2 rounded-lg border text-white",
              canUpload
                ? "border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
                : "border-white/15 bg-zinc-800 opacity-50 cursor-not-allowed"
            )}
          >
            {canUpload ? "Looks good — Upload" : "Fix issues to upload"}
          </button>
        </div>

        <p className="mt-3 text-xs text-white/50">
          Tip: Use a square PNG/WebP ≤ 1 MB for best results. SVGs are great too.
        </p>
      </div>
    </div>
  );
}
