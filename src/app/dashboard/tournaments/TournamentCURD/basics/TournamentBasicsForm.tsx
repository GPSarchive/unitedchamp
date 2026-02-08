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
  // Get store action to mark tournament as dirty (no auto-save)
  const updateTournament = useTournamentStore(s => s.updateTournament);

  const editedSlug = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>("");

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
    setDebugInfo(`Loading logo: ${logo || 'none'}`);

    if (!logo) {
      console.log("no logo -> default");
      setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
      setDebugInfo("No logo set");
      console.groupEnd();
      return () => ctrl.abort();
    }

    if (/^https?:\/\//i.test(logo)) {
      console.log("absolute url -> use as-is");
      setLogoPreview(logo);
      setDebugInfo(`Using absolute URL: ${logo}`);
      console.groupEnd();
      return () => ctrl.abort();
    }

    const hasSlash = logo.includes("/");
    const resolvedKey = hasSlash
      ? logo.replace(/^\/+/, "")
      : `leagues/${String(slug).toLowerCase().trim()}/logos/${logo}`;
    const bucket = "GPSarchive's Project";
    const q = new URLSearchParams({ bucket, path: resolvedKey });
    const url = `/api/storage?${q.toString()}`;

    console.log("sign request", { bucket, resolvedKey, url });
    setDebugInfo(`Fetching signed URL for: ${resolvedKey}`);

    fetch(url, { credentials: "include", signal: ctrl.signal })
      .then(async (res) => {
        const text = await res.text().catch(() => "");
        let body: any = null;
        try { body = text ? JSON.parse(text) : null; } catch {}
        console.log("sign response", { status: res.status, body });
        
        if (!res.ok) {
          console.error("❌ Sign request failed", { status: res.status, body });
          setDebugInfo(`❌ Sign failed (${res.status}): ${body?.error || 'unknown'}`);
          setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
          return;
        }
        
        if (!body?.signedUrl) {
          console.error("❌ No signedUrl in response", body);
          setDebugInfo("❌ No signed URL received");
          setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
          return;
        }
        
        console.log("✅ Got signed URL:", body.signedUrl);
        setLogoPreview(body.signedUrl);
        setDebugInfo(`✅ Loaded: ${resolvedKey.split('/').pop()}`);
      })
      .catch((e) => {
        console.error("❌ sign fetch error", e);
        setDebugInfo(`❌ Fetch error: ${e.message}`);
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
      console.log("step3 saving logo path to form state", { path, saved: logoPath });
      onChange({ ...value, logo: logoPath });

      // Step 4: Mark tournament as DIRTY (no auto-save, waits for "Save Changes" button)
      console.log("step4 marking tournament as dirty (will save on 'Save Changes')");
      updateTournament({ logo: logoPath } as any); // Sets dirty.tournament = true

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
        setDebugInfo(`✅ Uploaded: ${path.split('/').pop()}`);
        console.log("step5 preview set immediately ✓");
      }

      console.log("✓ Upload complete - logo will save when you click 'Save Changes'");

    } catch (err) {
      console.error("[upload] error", err);
      setDebugInfo(`❌ Upload failed: ${(err as Error).message}`);
      alert((err as Error).message || String(err));
    } finally {
      console.groupEnd();
      setUploading(false);
    }
  }

  const fieldCls =
    "w-full bg-white/[0.05] border border-white/[0.1] rounded-lg px-3 py-2.5 text-white placeholder-white/30 " +
    "focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-400/30 transition";

  const statusLabels: Record<string, string> = { scheduled: "Scheduled", running: "Running", completed: "Completed", archived: "Archived" };
  const formatLabels: Record<string, string> = { league: "League", groups: "Groups", knockout: "Knockout", mixed: "Mixed" };

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-slate-900/80 to-indigo-950/60 p-5 sm:p-6 shadow-2xl">
      {/* Logo + Name row */}
      <div className="flex items-start gap-5 mb-6">
        <div className="flex-shrink-0">
          <div className="w-20 h-20 rounded-xl overflow-hidden bg-white/[0.04] border-2 border-dashed border-white/[0.12] flex items-center justify-center group relative">
            {logoPreview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoPreview} alt="Logo preview" className="w-full h-full object-cover" />
            ) : (
              <div className="flex flex-col items-center gap-1 text-white/30">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" /></svg>
                <span className="text-[10px]">Logo</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-2">
            <label className="relative inline-flex items-center px-2.5 py-1 rounded-lg border border-violet-400/30 bg-violet-500/10 text-violet-200 text-xs font-medium hover:bg-violet-500/20 cursor-pointer transition">
              <input
                type="file"
                accept="image/*"
                className="absolute inset-0 opacity-0 cursor-pointer"
                onChange={(e) => handleFilePick(e.target.files?.[0] ?? null)}
                disabled={uploading}
              />
              {uploading ? "Uploading..." : "Upload"}
            </label>
            {value.logo ? (
              <button
                className="text-[11px] px-2 py-1 rounded-lg border border-white/[0.1] text-white/50 hover:text-white/80 hover:bg-white/[0.05] transition"
                onClick={() => {
                  onChange({ ...value, logo: null });
                  setLogoPreview(DEFAULT_TOURNAMENT_LOGO);
                  setDebugInfo("Logo removed");
                  updateTournament({ logo: null } as any);
                }}
                type="button"
              >
                Remove
              </button>
            ) : null}
          </div>
          {debugInfo && (
            <div className="text-[10px] text-white/30 font-mono mt-1 max-w-[120px] truncate" title={debugInfo}>
              {debugInfo}
            </div>
          )}
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <label className="block text-xs font-medium text-white/50 mb-1.5">Tournament Name</label>
            <input
              className={fieldCls + " text-lg font-semibold"}
              placeholder="e.g. Champions League 2025"
              value={value.name ?? ""}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Slug</label>
              <input
                className={fieldCls}
                placeholder="auto-generated-slug"
                value={value.slug ?? ""}
                onChange={(e) => {
                  editedSlug.current = true;
                  onChange({ ...value, slug: e.target.value || null });
                }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Season</label>
              <input
                className={fieldCls}
                placeholder="e.g. 2025"
                value={value.season ?? ""}
                onChange={(e) => onChange({ ...value, season: e.target.value || null })}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom row: Status, Format, Logo URL */}
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Status</label>
          <select
            className={fieldCls}
            value={value.status ?? "scheduled"}
            onChange={(e) => onChange({ ...value, status: e.target.value as any })}
          >
            {Object.entries(statusLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Format</label>
          <select
            className={fieldCls}
            value={value.format ?? "league"}
            onChange={(e) => onChange({ ...value, format: e.target.value as any })}
          >
            {Object.entries(formatLabels).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/50 mb-1.5">Logo URL</label>
          <input
            className={fieldCls}
            placeholder="/leagues/.../logo.jpg"
            value={value.logo ?? ""}
            onChange={(e) => {
              onChange({ ...value, logo: e.target.value || null });
              updateTournament({ logo: e.target.value || null } as any);
            }}
          />
        </div>
      </div>
    </div>
  );
}