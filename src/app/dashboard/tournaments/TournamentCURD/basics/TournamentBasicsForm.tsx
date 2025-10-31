// app/dashboard/tournaments/TournamentCURD/basics/TournamentBasicsForm.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type { NewTournamentPayload } from "@/app/lib/types";
import { useTournamentStore } from "@/app/dashboard/tournaments/TournamentCURD/submit/tournamentStore";

type T = NewTournamentPayload["tournament"];

export default function TournamentBasicsForm({
  value,
  onChange,
}: {
  value: T;
  onChange: (next: T) => void;
}) {
  // Get store actions for immediate DB save
  const updateTournament = useTournamentStore(s => s.updateTournament);
  const saveAll = useTournamentStore(s => s.saveAll);
  const tournamentId = useTournamentStore(s => s.ids.tournamentId);
  const editedSlug = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

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
  }, [value.name]);

  const DEFAULT_TOURNAMENT_LOGO = "/images/tournament-default.svg";

  useEffect(() => {
    const slug = (value.slug || value.name || "tournament") as string;
    const logo = (value.logo || "") as string;
    const id = Math.random().toString(36).slice(2);
    const ctrl = new AbortController();

    console.groupCollapsed(`[TBForm][preview][${id}] start`);
    console.log("inputs", { slug, logo });

    if (!logo) {
      console.log("no logo -> default");
      setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
      console.groupEnd();
      return () => ctrl.abort();
    }

    if (/^https?:\/\//i.test(logo)) {
      console.log("absolute url -> use as-is");
      setLogoPreview(logo);
      console.groupEnd();
      return () => ctrl.abort();
    }

    const hasSlash = logo.includes("/");
    const resolvedKey = hasSlash
      ? logo.replace(/^\/+/, "")
      : `leagues/${String(slug).toLowerCase().trim()}/logos/${logo}`;
    const bucket =
      process.env.NEXT_PUBLIC_SUPABASE_TOURNAMENTS_BUCKET || "tournaments";
    const q = new URLSearchParams({ bucket, path: resolvedKey });
    const url = `/api/storage?${q.toString()}`;

    console.log("sign request", { bucket, resolvedKey, url });

    fetch(url, { credentials: "include", signal: ctrl.signal })
      .then(async (res) => {
        const text = await res.text().catch(() => "");
        let body: any = null;
        try { body = text ? JSON.parse(text) : null; } catch {}
        console.log("sign response", { status: res.status, body });
        if (!res.ok || !body?.signedUrl) {
          setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
          return;
        }
        setLogoPreview(body.signedUrl);
      })
      .catch((e) => {
        console.warn("sign fetch error", e);
        setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
      })
      .finally(() => console.groupEnd());

    return () => ctrl.abort();
  }, [value.logo, value.slug, value.name]);

  async function handleFilePick(file: File | null) {
    if (!file) return;
    setUploading(true);
    const trace = Math.random().toString(36).slice(2);
    console.groupCollapsed(`[TBForm][upload][${trace}] start`);
    try {
      console.log("file", { name: file.name, type: file.type, size: file.size });
      console.log("dirName", dirName);

      // Step 1: Get signed upload URL
      const r1 = await fetch("/api/storage/tournaments/image-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dirName,
          contentType: file.type || "image/jpeg",
          kind: "logos",
        }),
      });
      const a1 = await r1.json().catch(() => null);
      console.log("step1 createSignedUploadUrl", { status: r1.status, a1 });
      if (!r1.ok) throw new Error(a1?.error || "Failed to get signed upload URL");

      const { signedUrl, token, path, bucket } = a1 as any;

      // Step 2: Upload file to storage
      const r2 = await fetch(signedUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "image/jpeg",
          "x-upsert": "true",
          Authorization: `Bearer ${token}`,
        },
        body: file,
      });
      const t2 = await r2.text().catch(() => "");
      console.log("step2 PUT upload", { status: r2.status, text: t2.slice(0, 200) });
      if (!r2.ok) throw new Error(`Upload failed (${r2.status}): ${t2 || "unknown"}`);

      // Step 3: Save logo path to form state
      const logoPath = `/${path}`;
      console.log("saving logo path", { path, saved: logoPath });
      onChange({ ...value, logo: logoPath });

      // Step 4: IMMEDIATE DB UPDATE via tournamentStore (if tournament exists in DB)
      if (tournamentId && tournamentId > 0) {
        console.log("step4 immediate DB save via tournamentStore", tournamentId);
        try {
          updateTournament({ logo: logoPath }); // Mark dirty in store
          await saveAll(); // Persist to DB via /save-all API
          console.log("step4 DB save successful");
        } catch (err) {
          console.warn("DB save failed, but file uploaded successfully:", err);
          // Don't throw - file is uploaded, user can save form later
        }
      }

      // Step 5: Fetch signed URL for immediate preview
      const encBucket = encodeURIComponent(bucket);
      const encPath = encodeURIComponent(path);
      const r5 = await fetch(`/api/storage?bucket=${encBucket}&path=${encPath}`, {
        credentials: "include",
      });
      const a5 = await r5.json().catch(() => null);
      console.log("step5 sign for immediate preview", { status: r5.status, a5 });
      
      if (r5.ok && a5?.signedUrl) {
        setLogoPreview(a5.signedUrl);
        console.log("preview set immediately:", a5.signedUrl);
      }

    } catch (err) {
      console.error("[upload] error", err);
      alert((err as Error).message || String(err));
    } finally {
      console.groupEnd();
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
              onClick={() => {
                onChange({ ...value, logo: null });
                setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
              }}
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