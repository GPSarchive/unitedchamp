// app/dashboard/tournaments/TournamentCURD/basics/TournamentBasicsForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";

type T = NewTournamentPayload["tournament"];

export default function TournamentBasicsForm({
  value,
  onChange,
}: {
  value: T;
  onChange: (next: T) => void;
}) {
  const editedSlug = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // derive a sensible dirName for uploads
  const dirName =
    (value.slug && value.slug.trim()) ||
    (value.name && value.name.trim()) ||
    "tournament";

  useEffect(() => {
    if (!editedSlug.current && value.name) {
      const slug = value.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      onChange({ ...value, slug });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.name]);

  // Whenever logo changes, compute a preview URL:
  // - if it's absolute http(s), use as-is
  // - if it starts with '/', we assume it's a storage path like '/leagues/.../file.jpg'
  useEffect(() => {
    const logo = value.logo || "";
    const isHttp = /^https?:\/\//i.test(logo);
    if (isHttp) {
      setLogoPreview(logo);
      return;
    }
    const rawPath = String(logo || "").replace(/^\/+/, ""); // strip leading /
    if (!rawPath) {
      setLogoPreview(null);
      return;
    }

    // Use the signer route to get a temporary URL for display
    // Note: we don't know the bucket here; use your default bucket name.
    const defaultBucket = "GPSarchive's Project";
    const bucketQP = encodeURIComponent(defaultBucket);
    const pathQP = encodeURIComponent(rawPath);
    fetch(`/api/storage?bucket=${bucketQP}&path=${pathQP}`, { credentials: "include" })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
        setLogoPreview(body?.signedUrl ?? null);
      })
      .catch(() => setLogoPreview(null));
  }, [value.logo]);

  async function handleFilePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      // 1) Ask the dedicated tournaments route for a signed upload URL
      //    Files will be placed under leagues/[dirName]/logos/<uuid>.<ext>
      const r1 = await fetch("/api/tournaments/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dirName,                  // leaf folder derived from slug/name
          contentType: file.type || "image/jpeg",
          kind: "logos",            // optional subfolder
        }),
      });
      const a1 = await r1.json().catch(() => null);
      if (!r1.ok) throw new Error(a1?.error || "Failed to get signed upload URL");

      const { signedUrl, token, path, bucket } = a1 as {
        signedUrl: string;
        token: string;
        path: string;
        bucket: string;
      };

      // 2) Upload the file with PUT to the signedUrl
      const r2 = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/jpeg",
          "x-upsert": "true",
          "Authorization": `Bearer ${token}`,
        },
        body: file,
      });
      if (!r2.ok) {
        const text = await r2.text().catch(() => "");
        throw new Error(`Upload failed (${r2.status}): ${text || "unknown error"}`);
      }

      // 3) Save the *storage path* (with leading slash to satisfy LogoSchema) in the form
      //    Example: "/leagues/mini-euro-2025/logos/09f2f...jpg"
      onChange({ ...value, logo: `/${path}` });

      // 4) Get a signed preview to show instantly (use the bucket returned by the API)
      const encBucket = encodeURIComponent(bucket);
      const encPath = encodeURIComponent(path);
      const r3 = await fetch(`/api/storage?bucket=${encBucket}&path=${encPath}`, {
        credentials: "include",
      });
      const a3 = await r3.json().catch(() => null);
      if (r3.ok && a3?.signedUrl) setLogoPreview(a3.signedUrl);
    } catch (err) {
      alert((err as Error).message || String(err));
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-cyan-400/20 bg-gradient-to-br from-slate-900/60 to-indigo-950/50 p-4 space-y-3">
      <h2 className="text-xl font-semibold text-cyan-200">Tournament</h2>

      {/* Logo preview + uploader */}
      <div className="flex items-center gap-3">
        <div className="w-16 h-16 rounded-md overflow-hidden bg-slate-900/60 border border-white/10 flex items-center justify-center">
          {logoPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
          ) : (
            <span className="text-xs text-white/50">No logo</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="relative inline-flex items-center px-3 py-1.5 rounded-md border border-cyan-400/30 text-cyan-100 hover:bg-cyan-500/10 cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 opacity-0 cursor-pointer"
              onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
              disabled={uploading}
            />
            {uploading ? "Uploading…" : "Upload Logo"}
          </label>
          {value.logo ? (
            <button
              className="text-xs px-2 py-1 rounded-md border border-white/10 text-white/80 hover:bg-white/5"
              onClick={() => onChange({ ...value, logo: null })}
              type="button"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Name"
          value={value.name ?? ""}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
        />
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Slug"
          value={value.slug ?? ""}
          onChange={(e) => {
            editedSlug.current = true;
            onChange({ ...value, slug: e.target.value || null });
          }}
        />
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder="Season (e.g. 2025)"
          value={value.season ?? ""}
          onChange={(e) => onChange({ ...value, season: e.target.value || null })}
        />
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          value={value.status ?? "scheduled"}
          onChange={(e) => onChange({ ...value, status: e.target.value as any })}
        >
          {["scheduled", "running", "completed", "archived"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          value={value.format ?? "league"}
          onChange={(e) => onChange({ ...value, format: e.target.value as any })}
        >
          {["league", "groups", "knockout", "mixed"].map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          className="bg-slate-950 border border-cyan-400/20 rounded-md px-3 py-2 text-white placeholder-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60"
          placeholder='Logo URL (http… or "/leagues/…/file.jpg")'
          value={value.logo ?? ""}
          onChange={(e) => onChange({ ...value, logo: e.target.value || null })}
        />
      </div>
    </div>
  );
}
