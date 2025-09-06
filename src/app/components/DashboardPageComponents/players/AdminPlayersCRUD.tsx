"use client";

import React, { useEffect, useMemo, useState } from "react";
import { safeJson } from "@/app/components/DashboardPageComponents/teams/teamHelpers";
import { PlayerWithStats, PlayerFormPayload } from "./types";
import PlayersToolbar from "./PlayersToolbar";
import PlayersGrid from "./PlayersGrid";
import PlayerEditorDrawer from "./PlayerEditorDrawer";

export default function AdminPlayersCRUD() {
  const [players, setPlayers] = useState<PlayerWithStats[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // search
  const [q, setQ] = useState("");

  // editor
  const [showEditor, setShowEditor] = useState(false);
  const [editing, setEditing] = useState<PlayerWithStats | null>(null);
  const isEdit = !!editing?.id;

  const valid = useMemo(() => true, []); // validation handled in editor

  // ---- debug helpers ----
  const DEBUG =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("debug") === "1";

  function firstStats(p: PlayerWithStats) {
    const ps: any = (p as any).player_statistics;
    if (Array.isArray(ps)) return ps[0] ?? null;
    if (ps && typeof ps === "object") return ps; // single object form
    return null;
  }

  function logPlayers(rows: PlayerWithStats[] | undefined, label = "players") {
    if (!DEBUG) return;
    const list = rows ?? [];
    let withStats = 0,
      without = 0;

    const flat = list.map((p) => {
      const s = firstStats(p);
      if (s) withStats++;
      else without++;
      return {
        id: p.id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        hasStats: !!s,
        age: s?.age ?? null,
        goals: s?.total_goals ?? 0,
        assists: s?.total_assists ?? 0,
        _rawType: Array.isArray((p as any).player_statistics)
          ? "array"
          : (p as any).player_statistics
          ? "object"
          : "missing",
      };
    });

    console.log(
      `[AdminPlayersCRUD] ${label}: total=${list.length}, withStats=${withStats}, without=${without}`
    );
    console.table(flat);
  }

  // Normalize server shape so `player_statistics` is ALWAYS an array
  function normalizePlayer(p: PlayerWithStats): PlayerWithStats {
    const ps: any = (p as any).player_statistics;
    const arr = Array.isArray(ps) ? ps : ps ? [ps] : [];
    return { ...p, player_statistics: arr as any };
  }
  function normalizeMany(arr: PlayerWithStats[]): PlayerWithStats[] {
    return (arr ?? []).map(normalizePlayer);
  }

  // -------- Data ----------
  async function fetchPlayers() {
    setLoading(true);
    setError(null);
    try {
      // propagate ?debug=1 to API to get debug headers if your API supports them
      const debugParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("debug")
          : null;

      let url = q.trim()
        ? `/api/players?q=${encodeURIComponent(q)}`
        : `/api/players`;
      if (debugParam === "1") {
        url += url.includes("?") ? "&debug=1" : "?debug=1";
      }

      const t0 = performance.now();
      const res = await fetch(url, { credentials: "include" });

      if (DEBUG) {
        console.log("[AdminPlayersCRUD] GET /api/players headers:", {
          "X-Debug-Players-Count": res.headers.get("X-Debug-Players-Count"),
          "X-Debug-Total-Count": res.headers.get("X-Debug-Total-Count"),
          "X-Debug-Query-TimeMs": res.headers.get("X-Debug-Query-TimeMs"),
        });
      }

      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      const rows = (body?.players as PlayerWithStats[]) ?? [];
      if (DEBUG) {
        console.log(
          `[AdminPlayersCRUD] fetchPlayers took ${(performance.now() - t0).toFixed(1)} ms`
        );
        logPlayers(rows, "serverResponse (raw)");
        if (body?.debug) console.log("[AdminPlayersCRUD] route debug:", body.debug);
      }

      const normalized = normalizeMany(rows);
      if (DEBUG) {
        // store for quick inspection in DevTools
        (window as any).__players = normalized;
        logPlayers(normalized, "normalizedResponse");
      }

      setPlayers(normalized);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      if (DEBUG) console.error("[AdminPlayersCRUD] fetchPlayers error:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPlayers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Log whenever state changes (what the UI will actually render)
  useEffect(() => {
    logPlayers(players, "state");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [players]);

  // -------- Handlers ----------
  function openCreate() {
    setEditing(null);
    setShowEditor(true);
  }
  function openEdit(p: PlayerWithStats) {
    if (DEBUG) console.log("[AdminPlayersCRUD] openEdit:", p);
    setEditing(p);
    setShowEditor(true);
  }
  function closeEditor() {
    if (DEBUG) console.log("[AdminPlayersCRUD] closeEditor");
    setShowEditor(false);
    setEditing(null);
  }

  async function handleSave(payload: PlayerFormPayload) {
    try {
      if (DEBUG)
        console.log(
          "[AdminPlayersCRUD] handleSave payload:",
          payload,
          "isEdit:",
          isEdit
        );

      if (isEdit) {
        const res = await fetch(`/api/players/${editing!.id}${DEBUG ? "?debug=1" : ""}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (DEBUG) console.log("[AdminPlayersCRUD] PATCH response:", body);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

        const updated = normalizePlayer(body?.player as PlayerWithStats);
        setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const res = await fetch(`/api/players${DEBUG ? "?debug=1" : ""}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        const body = await safeJson(res);
        if (DEBUG) console.log("[AdminPlayersCRUD] POST response:", body);
        if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

        const created = normalizePlayer(body?.player as PlayerWithStats);
        setPlayers((prev) => [created, ...prev]);
      }
      closeEditor();
    } catch (e: any) {
      if (DEBUG) console.error("[AdminPlayersCRUD] handleSave error:", e);
      alert(e?.message ?? String(e));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Permanently delete this player? This also removes their stats and team links."))
      return;
    try {
      if (DEBUG) console.log("[AdminPlayersCRUD] handleDelete id:", id);
      const res = await fetch(`/api/players/${id}${DEBUG ? "?debug=1" : ""}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (DEBUG) console.log("[AdminPlayersCRUD] DELETE response:", body);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
      setPlayers((prev) => prev.filter((p) => p.id !== id));
    } catch (e: any) {
      if (DEBUG) console.error("[AdminPlayersCRUD] handleDelete error:", e);
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-4">
      <PlayersToolbar q={q} onChangeQ={setQ} onSearch={fetchPlayers} onNew={openCreate} />

      {loading ? (
        <p className="text-white/70">Loading…</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : players.length === 0 ? (
        <p className="text-white/60">No players found.</p>
      ) : (
        <PlayersGrid players={players} onEdit={openEdit} onDelete={handleDelete} />
      )}

      <PlayerEditorDrawer
        open={showEditor}
        onClose={closeEditor}
        player={editing}
        onSubmit={handleSave}
      />
    </div>
  );
}
