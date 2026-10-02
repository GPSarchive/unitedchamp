"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Loader2, Search, UserPlus, Users, History } from "lucide-react";
import type {
  PlayerRow as Player,
  PlayerStatisticsRow as PlayerStat,
  PlayerAssociation,
} from "@/app/lib/types";
import type { PlayerSearchHit } from "@/app/api/players/search/route";
import type {
  PreviousRosterPlayer,
  PreviousRosterSource,
} from "@/app/api/teams/[id]/previous-roster/route";
import { useIsAdmin } from "../ui/DashboardRole";

type Props = {
  teamId: number;
  associations?: PlayerAssociation[];
  isLoading: boolean;
  error?: string | null;
  onOpenPlayer: (playerId: number) => void;
};

async function safeJson(res: Response) {
  try {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) return await res.json();
  } catch {}
  return null;
}

const num = (v: unknown, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};

/** Initials disc — the roster boxes list many players and signing a photo URL per row is not worth it. */
function Avatar({ first, last }: { first: string; last: string }) {
  const initials = `${(first ?? "").trim().charAt(0)}${(last ?? "").trim().charAt(0)}`.toUpperCase() || "?";
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-zinc-800 text-xs font-semibold text-white/80">
      {initials}
    </span>
  );
}

export default function PlayersPanel({
  teamId,
  associations,
  isLoading,
  error,
  onOpenPlayer,
}: Props) {
  // "Αφαίρεση & αρχειοθέτηση" ends in DELETE /api/players/[id], admin-only.
  const isAdmin = useIsAdmin();
  const [list, setList] = useState<PlayerAssociation[]>(associations ?? []);
  useEffect(() => setList(associations ?? []), [associations]);

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"existing" | "create">("existing");

  // ── Live search (GET /api/players/search): fires as the admin types,
  // accent/case-insensitive, word-prefix ranked; see lib/playerSearch.ts.
  const [q, setQ] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<PlayerSearchHit[]>([]);
  const [searchErr, setSearchErr] = useState<string | null>(null);
  const searchAbort = useRef<AbortController | null>(null);

  // ── Last season's roster (GET /api/teams/:id/previous-roster), offered
  // for re-signing into THIS season's team row.
  const [prevLoading, setPrevLoading] = useState(false);
  const [prevSource, setPrevSource] = useState<PreviousRosterSource | null>(null);
  const [prevPlayers, setPrevPlayers] = useState<PreviousRosterPlayer[]>([]);
  const [prevErr, setPrevErr] = useState<string | null>(null);

  const [busyIds, setBusyIds] = useState<Set<number>>(() => new Set());
  const [addingAll, setAddingAll] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const rosterIds = new Set(list.map((a) => a.player.id));

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    searchAbort.current?.abort();
    if (!term) {
      setResults([]);
      setSearching(false);
      setSearchErr(null);
      return;
    }
    const ctrl = new AbortController();
    searchAbort.current = ctrl;
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const url = new URL("/api/players/search", window.location.origin);
        url.searchParams.set("q", term);
        url.searchParams.set("excludeTeamId", String(teamId));
        url.searchParams.set("limit", "40");
        const res = await fetch(url.toString(), { credentials: "include", signal: ctrl.signal });
        const data = (await safeJson(res)) ?? {};
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (ctrl.signal.aborted) return;
        setResults((data.players as PlayerSearchHit[]) ?? []);
        setSearchErr(null);
      } catch (e: any) {
        if (ctrl.signal.aborted) return;
        setResults([]);
        setSearchErr(e?.message ?? String(e));
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open, teamId]);

  useEffect(() => {
    if (!open || tab !== "existing") return;
    let cancelled = false;
    setPrevLoading(true);
    setPrevErr(null);
    (async () => {
      try {
        const res = await fetch(`/api/teams/${teamId}/previous-roster`, { credentials: "include" });
        const data = (await safeJson(res)) ?? {};
        if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
        if (cancelled) return;
        setPrevSource((data.source as PreviousRosterSource | null) ?? null);
        setPrevPlayers((data.players as PreviousRosterPlayer[]) ?? []);
      } catch (e: any) {
        if (cancelled) return;
        setPrevSource(null);
        setPrevPlayers([]);
        setPrevErr(e?.message ?? String(e));
      } finally {
        if (!cancelled) setPrevLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, teamId]);

  useEffect(() => {
    if (open) return;
    setNotice(null);
    setQ("");
    setResults([]);
  }, [open]);

  /** Link one existing player to this team row. Resolves true on success; errors are shown, not thrown. */
  async function addExisting(playerId: number, opts: { quiet?: boolean } = {}): Promise<boolean> {
    setBusyIds((s) => new Set(s).add(playerId));
    try {
      const res = await fetch(`/api/teams/${teamId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ player_id: playerId }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      const assoc = data.association as PlayerAssociation;
      setList((xs) => (xs.some((a) => a.player.id === assoc.player.id) ? xs : [...xs, assoc]));
      setResults((xs) => xs.filter((p) => p.id !== playerId));
      setPrevPlayers((xs) => xs.filter((p) => p.id !== playerId));
      if (!opts.quiet) {
        setNotice({ ok: true, text: `Προστέθηκε: ${assoc.player.first_name} ${assoc.player.last_name}` });
      }
      return true;
    } catch (e: any) {
      if (!opts.quiet) setNotice({ ok: false, text: e?.message ?? String(e) });
      return false;
    } finally {
      setBusyIds((s) => {
        const n = new Set(s);
        n.delete(playerId);
        return n;
      });
    }
  }

  /** Re-sign every remaining player of last season's roster, one request each. */
  async function addAllPrevious() {
    if (prevPlayers.length === 0) return;
    if (!confirm(`Να προστεθούν και οι ${prevPlayers.length} παίκτες της «${prevSource?.name ?? ""}» στο ρόστερ;`)) return;
    setAddingAll(true);
    let ok = 0;
    const failed: string[] = [];
    for (const p of [...prevPlayers]) {
      const done = await addExisting(p.id, { quiet: true });
      if (done) ok += 1;
      else failed.push(`${p.first_name} ${p.last_name}`);
    }
    setAddingAll(false);
    setNotice(
      failed.length === 0
        ? { ok: true, text: `Προστέθηκαν ${ok} παίκτες από την περσινή ομάδα.` }
        : { ok: false, text: `Προστέθηκαν ${ok}. Απέτυχαν: ${failed.join(", ")}` },
    );
  }

  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [age, setAge] = useState<number | "" | null>(null);

  // Extended player fields
  const [photo, setPhoto] = useState("");
  const [height, setHeight] = useState<number | "" | null>(null);
  const [position, setPosition] = useState("");
  const [birth, setBirth] = useState("");
  const [playerNumber, setPlayerNumber] = useState<number | "" | null>(null);

  // Card statistics
  const [yellowCards, setYellowCards] = useState<number | "" | null>(0);
  const [redCards, setRedCards] = useState<number | "" | null>(0);
  const [blueCards, setBlueCards] = useState<number | "" | null>(0);

  // Goals and assists
  const [goals, setGoals] = useState<number | "" | null>(0);
  const [assists, setAssists] = useState<number | "" | null>(0);

  const validCreate = !!(first.trim() && last.trim());

  async function createAndAdd() {
    try {
      const res = await fetch(`/api/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          first_name: first.trim(),
          last_name: last.trim(),
          age: age === "" ? null : age,
          total_goals: goals === "" ? 0 : goals,
          total_assists: assists === "" ? 0 : assists,
          photo: photo.trim() || null,
          height_cm: height === "" ? null : height,
          position: position.trim() || null,
          birth_date: birth || null,
          player_number: playerNumber === "" ? null : playerNumber,
          yellow_cards: yellowCards === "" ? 0 : yellowCards,
          red_cards: redCards === "" ? 0 : redCards,
          blue_cards: blueCards === "" ? 0 : blueCards,
        }),
      });
      const data = (await safeJson(res)) ?? {};
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);

      const player = data.player as Player;
      // Created players go straight onto the roster; the drawer closes like before.
      const linked = await addExisting(player.id, { quiet: true });
      if (!linked) throw new Error("Ο παίκτης δημιουργήθηκε αλλά δεν προστέθηκε στην ομάδα.");
      setOpen(false);

      // Reset all fields
      setFirst("");
      setLast("");
      setAge(null);
      setPhoto("");
      setHeight(null);
      setPosition("");
      setBirth("");
      setPlayerNumber(null);
      setGoals(0);
      setAssists(0);
      setYellowCards(0);
      setRedCards(0);
      setBlueCards(0);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function removeFromTeam(playerId: number) {
    if (!teamId) return;
    if (!confirm("Να αφαιρεθεί ο παίκτης από την ομάδα;")) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      setList((xs) => body.playerAssociations ?? xs.filter((a: PlayerAssociation) => a.player.id !== playerId));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  async function removeAndArchive(playerId: number) {
    if (!teamId) return;
    if (
      !confirm(
        "Αρχειοθέτηση παίκτη; Ο παίκτης θα αφαιρεθεί από την ομάδα ΚΑΙ θα αρχειοθετηθεί — θα αποκρυφτεί από τα ρόστερ και τους νέους αγώνες, αλλά τα ιστορικά στατιστικά του διατηρούνται."
      )
    )
      return;

    try {
      // 1) Αφαίρεση από την ομάδα (disassociate)
      const res = await fetch(`/api/teams/${teamId}/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await safeJson(res);
      if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);

      // 2) Αρχειοθέτηση παίκτη (soft delete) — όπως το admin panel παικτών
      const archiveRes = await fetch(`/api/players/${playerId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const archiveBody = await safeJson(archiveRes);
      if (!archiveRes.ok) throw new Error(archiveBody?.error || `HTTP ${archiveRes.status}`);

      setList((xs) => body.playerAssociations ?? xs.filter((a: PlayerAssociation) => a.player.id !== playerId));
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  }

  return (
    <div>
      {/* Header with add button */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-white/90">Τρέχον ρόστερ</h3>
        <button
          type="button"
          onClick={() => {
            setTab("existing");
            setOpen(true);
          }}
          className="text-xs px-2 py-1 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50"
        >
          + Προσθήκη παίκτη
        </button>
      </div>

      {/* Scrollable players list */}
      <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {isLoading ? (
          <p className="text-white/70 py-4">Φόρτωση παικτών…</p>
        ) : error ? (
          <p className="text-red-400 py-4">Σφάλμα φόρτωσης παικτών: {error}</p>
        ) : !list || list.length === 0 ? (
          <p className="text-gray-400 py-4">Δεν υπάρχουν παίκτες σε αυτή την ομάδα.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {list.map((pa) => {
              const p = pa.player;
              const s = (p.player_statistics[0] as PlayerStat | undefined);
              const ageSafe = s?.age ?? null;

              return (
                <div
                  key={p.id}
                  className="group relative text-left w-full p-3 border border-orange-400/20 bg-orange-500/5 shadow-md rounded-md hover:border-orange-400/40 transition-all"
                >
                  <div className="absolute right-2 top-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => removeFromTeam(p.id)}
                      className="text-[11px] px-2 py-0.5 rounded border border-red-400/40 bg-red-900/30 hover:bg-red-900/50 transition-opacity"
                      title="Αφαίρεση από την ομάδα"
                    >
                      Αφαίρεση
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => removeAndArchive(p.id)}
                        className="text-[11px] px-2 py-0.5 rounded border border-amber-400/40 bg-amber-900/30 hover:bg-amber-900/50 transition-opacity"
                        title="Αφαίρεση από την ομάδα και αρχειοθέτηση παίκτη"
                      >
                        Αφαίρεση &amp; αρχειοθέτηση
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenPlayer(p.id)}
                    className="w-full text-left"
                    title="Επεξεργασία παίκτη"
                  >
                    <p className="text-white font-semibold pr-16 mt-7">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-gray-300 text-sm mt-1">Ηλικία: {ageSafe ?? "—"}</p>

                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                        Γκολ: {num(s?.total_goals)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300">
                        Ασίστ: {num(s?.total_assists)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-yellow-500/10 px-2 py-0.5 text-yellow-300">
                        Κίτρινες: {num(s?.yellow_cards)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-red-300">
                        Κόκκινες: {num(s?.red_cards)}
                      </span>
                      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-blue-300">
                        Μπλε: {num(s?.blue_cards)}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Side drawer for adding players */}
      {typeof window !== 'undefined' && createPortal(
        <div
          className={`fixed inset-0 z-[100] transition ${
            open ? "pointer-events-auto" : "pointer-events-none"
          }`}
          aria-hidden={!open}
        >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity ${
            open ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setOpen(false)}
        />

        {/* Side panel */}
        <div
  className={`absolute right-0 top-0 h-full w-full sm:w-[600px] md:w-[700px] lg:w-[800px] bg-zinc-950 border-l border-white/10 shadow-2xl transition-transform flex flex-col ${
    open ? "translate-x-0" : "translate-x-full"
  }`}
>
          {/* Panel header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-zinc-900/50 shrink-0">
            <div className="flex items-center gap-2">
              <button
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === "existing" 
                    ? "bg-emerald-700/30 text-white border border-emerald-400/40" 
                    : "text-white/70 hover:bg-white/5"
                }`}
                onClick={() => setTab("existing")}
              >
                Προσθήκη υπάρχοντος
              </button>
              <button
                className={`px-3 py-1.5 rounded text-sm transition-colors ${
                  tab === "create" 
                    ? "bg-emerald-700/30 text-white border border-emerald-400/40" 
                    : "text-white/70 hover:bg-white/5"
                }`}
                onClick={() => setTab("create")}
              >
                Δημιουργία νέου
              </button>
            </div>
            <button 
              onClick={() => setOpen(false)} 
              className="p-2 rounded-lg hover:bg-white/10 transition-colors" 
              title="Κλείσιμο"
            >
              <X className="h-5 w-5 text-white/80" />
            </button>
          </div>

          {/* Panel content */}
          <div className="flex flex-col flex-1 min-h-0">
            {tab === "existing" ? (
              <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                {notice && (
                  <p
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      notice.ok
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                        : "border-red-500/40 bg-red-500/10 text-red-100"
                    }`}
                  >
                    {notice.text}
                  </p>
                )}

                {/* ── Live search ─────────────────────────────────────── */}
                <section className="space-y-3">
                  <label className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50" />
                    <input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Αναζήτηση παίκτη με όνομα, επώνυμο ή αριθμό…"
                      autoFocus
                      className="w-full pl-9 pr-9 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                    />
                    {searching ? (
                      <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/50" />
                    ) : q ? (
                      <button
                        type="button"
                        onClick={() => setQ("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-white/50 hover:bg-white/10 hover:text-white"
                        aria-label="Καθαρισμός"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </label>
                  <p className="text-xs text-white/40">
                    Τα αποτελέσματα εμφανίζονται καθώς πληκτρολογείτε — χωρίς τόνους ή κεφαλαία, με όποια σειρά λέξεων.
                  </p>

                  {q.trim() ? (
                    searchErr ? (
                      <p className="text-sm text-red-300">Σφάλμα αναζήτησης: {searchErr}</p>
                    ) : results.filter((p) => !rosterIds.has(p.id)).length === 0 ? (
                      <p className="rounded-lg border border-white/10 bg-zinc-900/60 px-4 py-6 text-center text-sm text-white/50">
                        {searching ? "Αναζήτηση…" : `Δεν βρέθηκε παίκτης για «${q.trim()}».`}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {results
                          .filter((p) => !rosterIds.has(p.id))
                          .map((p) => (
                            <li
                              key={p.id}
                              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                            >
                              <Avatar first={p.first_name} last={p.last_name} />
                              <div className="min-w-0 flex-1 text-white">
                                <div className="font-medium truncate">
                                  {p.first_name} {p.last_name}
                                </div>
                                <div className="text-xs text-white/50 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                  <span>#{p.id}</span>
                                  {p.player_number != null && <span>Νο {p.player_number}</span>}
                                  {p.position && <span>{p.position}</span>}
                                  {p.age != null && <span>{p.age} ετών</span>}
                                  {p.teams.map((t) => (
                                    <span
                                      key={t.id}
                                      className="rounded-full bg-orange-500/10 px-2 py-0.5 text-orange-300"
                                      title="Ήδη σε ομάδα της τρέχουσας σεζόν"
                                    >
                                      {t.name}
                                    </span>
                                  ))}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={busyIds.has(p.id) || addingAll}
                                onClick={() => addExisting(p.id)}
                                className="shrink-0 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                              >
                                {busyIds.has(p.id) ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                                Προσθήκη
                              </button>
                            </li>
                          ))}
                      </ul>
                    )
                  ) : null}
                </section>

                {/* ── Last season's roster ─────────────────────────────── */}
                <section className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h4 className="flex items-center gap-2 text-sm font-semibold text-white/90">
                        <History className="h-4 w-4 text-white/60" />
                        Παίκτες από την προηγούμενη σεζόν
                      </h4>
                      {prevSource ? (
                        <p className="mt-0.5 text-xs text-white/50">
                          Ρόστερ της «{prevSource.name}» τη σεζόν {prevSource.display_label}
                          {prevSource.deleted ? " (αποχώρησε)" : ""}
                          {prevSource.via === "name"
                            ? " — βρέθηκε με βάση το όνομα, όχι από σύνδεση ομάδας."
                            : "."}
                        </p>
                      ) : null}
                    </div>
                    {prevSource && prevPlayers.length > 0 && (
                      <button
                        type="button"
                        disabled={addingAll || busyIds.size > 0}
                        onClick={addAllPrevious}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-emerald-400/40 bg-emerald-700/30 text-white hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {addingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Users className="h-3.5 w-3.5" />}
                        Προσθήκη όλων ({prevPlayers.length})
                      </button>
                    )}
                  </div>

                  {prevLoading ? (
                    <p className="flex items-center gap-2 text-sm text-white/60">
                      <Loader2 className="h-4 w-4 animate-spin" /> Φόρτωση περσινού ρόστερ…
                    </p>
                  ) : prevErr ? (
                    <p className="text-sm text-red-300">Σφάλμα: {prevErr}</p>
                  ) : !prevSource ? (
                    <p className="text-sm text-white/50">
                      Η ομάδα δεν συνδέεται με ομάδα προηγούμενης σεζόν. Ομάδες που δημιουργούνται με
                      «Δημιουργία από παλιά ομάδα» φέρνουν εδώ το περσινό τους ρόστερ.
                    </p>
                  ) : prevPlayers.length === 0 ? (
                    <p className="text-sm text-white/50">
                      Όλοι οι παίκτες της «{prevSource.name}» είναι ήδη στο φετινό ρόστερ.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {prevPlayers.map((p) => (
                        <li
                          key={p.id}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-white/10 bg-zinc-900 hover:bg-zinc-800 transition-colors"
                        >
                          <Avatar first={p.first_name} last={p.last_name} />
                          <div className="min-w-0 flex-1 text-white">
                            <div className="font-medium truncate">
                              {p.first_name} {p.last_name}
                            </div>
                            <div className="text-xs text-white/50 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>#{p.id}</span>
                              {p.player_number != null && <span>Νο {p.player_number}</span>}
                              {p.position && <span>{p.position}</span>}
                              {p.age != null && <span>{p.age} ετών</span>}
                              <span className="text-white/40">
                                {p.season_stats
                                  ? `${prevSource.display_label}: ${p.season_stats.matches} αγ. · ${p.season_stats.goals} γκολ · ${p.season_stats.assists} ασίστ`
                                  : `${prevSource.display_label}: χωρίς συμμετοχές`}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={busyIds.has(p.id) || addingAll}
                            onClick={() => addExisting(p.id)}
                            className="shrink-0 inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded border border-emerald-400/40 bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            title="Συμπερίληψη στο φετινό ρόστερ"
                          >
                            {busyIds.has(p.id) ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UserPlus className="h-4 w-4" />
                            )}
                            Προσθήκη
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : (
              <>
                <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                  <div className="space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Όνομα *</span>
                      <input
                        value={first}
                        onChange={(e) => setFirst(e.target.value)}
                        placeholder="π.χ. Γιάννης"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Επώνυμο *</span>
                      <input
                        value={last}
                        onChange={(e) => setLast(e.target.value)}
                        placeholder="π.χ. Παπαδόπουλος"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ηλικία</span>
                      <input
                        type="number"
                        min={0}
                        value={age === null ? "" : age}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAge(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 25"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Αριθμός φανέλας</span>
                      <input
                        type="number"
                        min={0}
                        value={playerNumber === null ? "" : playerNumber}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPlayerNumber(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 10"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Γκολ</span>
                      <input
                        type="number"
                        min={0}
                        value={goals === null ? "" : goals}
                        onChange={(e) => {
                          const v = e.target.value;
                          setGoals(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ασίστ</span>
                      <input
                        type="number"
                        min={0}
                        value={assists === null ? "" : assists}
                        onChange={(e) => {
                          const v = e.target.value;
                          setAssists(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Extended Profile */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm text-white/80 font-medium">Φωτογραφία (διαδρομή)</span>
                      <input
                        value={photo}
                        onChange={(e) => setPhoto(e.target.value)}
                        placeholder="π.χ. players/john-doe/photo.jpg"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Ύψος (cm)</span>
                      <input
                        type="number"
                        min={0}
                        value={height === null ? "" : height}
                        onChange={(e) => {
                          const v = e.target.value;
                          setHeight(v === "" ? "" : Number(v));
                        }}
                        placeholder="π.χ. 180"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Θέση</span>
                      <input
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        placeholder="π.χ. RW, CF"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2 sm:col-span-2">
                      <span className="text-sm text-white/80 font-medium">Ημερομηνία γέννησης</span>
                      <input
                        type="date"
                        value={birth}
                        onChange={(e) => setBirth(e.target.value)}
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>

                  {/* Card Statistics */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Κίτρινες κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={yellowCards === null ? "" : yellowCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setYellowCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Κόκκινες κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={redCards === null ? "" : redCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setRedCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                    <label className="flex flex-col gap-2">
                      <span className="text-sm text-white/80 font-medium">Μπλε κάρτες</span>
                      <input
                        type="number"
                        min={0}
                        value={blueCards === null ? "" : blueCards}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBlueCards(v === "" ? 0 : Number(v));
                        }}
                        placeholder="0"
                        className="px-3 py-2 rounded-lg bg-zinc-900 text-white border border-white/10 focus:border-emerald-400/40 focus:outline-none transition-colors"
                      />
                    </label>
                  </div>
                  </div>
                </div>

                <div className="p-4 border-t border-white/10 bg-zinc-950">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={!validCreate}
                      onClick={createAndAdd}
                      className="px-4 py-2 rounded-lg border border-emerald-400/40 text-white bg-emerald-700/30 hover:bg-emerald-700/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Δημιουργία & προσθήκη
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>,
      document.body
    )}

      {/* Custom scrollbar styles */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
}