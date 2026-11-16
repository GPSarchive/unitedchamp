// The «Πρωταθλητές» dashboard: staff give special card skins as rewards.
//
//   · one tab per skin (skins.ts) — «Θρύλος» first, more as they are made;
//   · «Ομάδες»: pick a season and a team, then give the skin to the whole
//     team or tick players one by one; «Παίκτες»: find anyone by name;
//   · below, every holder's card in that skin, each with the photo framing
//     editor of /preview/special-cards (drag the photo, zoom, «Τέλος» saves)
//     and the team whose logo the card wears.
//
// Nothing is given automatically. Writes are optimistic and rolled back if
// the server action fails.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MiniCard from "@/app/paiktes/MiniCard";
import { foldText, type DirectoryTeam, type StatTuple } from "@/app/preview/paiktes-v2/model";
import {
  DEFAULT_FRAMING,
  Framed,
  FramingControls,
  FramingStyles,
  PhotoDragLayer,
} from "@/app/preview/special-cards/framing";
import { giveSkin, takeSkin, updateSkinCard } from "./actions";
import { CARD_SKINS, type CardFraming, type SkinHolder, type SkinKey } from "./skins";
import { SKIN_CARDS } from "./skinCards";

export type SkinSeason = { label: string; display: string; active: boolean };
export type SkinTeam = { id: number; name: string; logo: string | null; season: string | null; archived: boolean };
export type SkinPlayer = {
  id: number;
  first: string;
  last: string;
  photo: string | null;
  hasPhoto: boolean;
  /** Every team the player is rostered on, newest season first. */
  teamIds: number[];
  /** Team a card gets when the skin is given to the player alone. */
  mainTeamId: number | null;
  /** Active-season numbers, as on /paiktes; null = no appearances this season. */
  stats: StatTuple | null;
};

/** Big cards added to the page per step while scrolling (each carries effects + a full photo). */
const STEP = 12;
const SEARCH_LIMIT = 40;
const NO_SEASON = "__none__";

const holderKey = (playerId: number, skin: SkinKey) => `${playerId}:${skin}`;
const fullName = (p: SkinPlayer) => `${p.last} ${p.first}`.trim() || `Παίκτης #${p.id}`;
const initialOf = (p: SkinPlayer) => (p.last || p.first || "?").charAt(0).toUpperCase();
const sameFraming = (a: CardFraming, b: CardFraming) => a.x === b.x && a.y === b.y && a.zoom === b.zoom;
const toDirectoryTeam = (t: SkinTeam | undefined | null): DirectoryTeam | null =>
  t ? { id: t.id, name: t.name, logo: t.logo } : null;

// ───────────────────────────────────────────────────────────────────────
// Small pieces
// ───────────────────────────────────────────────────────────────────────

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
        active
          ? "border-[#D4AF37] bg-[#D4AF37] font-semibold text-[#0a0a14]"
          : "border-white/15 text-white/80 hover:border-white/40"
      }`}
    >
      {children}
    </button>
  );
}

function TeamLogo({ team, size = "h-7 w-7" }: { team: SkinTeam | null | undefined; size?: string }) {
  if (!team?.logo) {
    return <span aria-hidden className={`${size} shrink-0 rounded-full bg-zinc-800 ring-1 ring-white/10`} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={team.logo}
      alt=""
      loading="lazy"
      className={`${size} shrink-0 rounded-full bg-white/5 object-contain ring-1 ring-white/10`}
    />
  );
}

/** A big card in a 300px box (the width it is designed for), at the page's scale. */
function Sized({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[calc(420px*var(--card-scale))] w-[calc(300px*var(--card-scale))]">
      <div className="w-[300px] origin-top-left [transform:scale(var(--card-scale))]">{children}</div>
    </div>
  );
}

const buttonBase = "rounded-full border px-3 py-1 text-[13px] transition-colors disabled:cursor-not-allowed disabled:opacity-40";
const giveButton = `${buttonBase} border-[#D4AF37] bg-[#D4AF37] font-semibold text-[#0a0a14] hover:bg-[#e2c255]`;
const takeButton = `${buttonBase} border-white/15 text-white/80 hover:border-red-400/60 hover:text-red-200`;
const quietButton = `${buttonBase} border-white/15 text-white/80 hover:border-white/40`;

// ───────────────────────────────────────────────────────────────────────
// One player in a list: mini card (in the skin once given), name, toggle
// ───────────────────────────────────────────────────────────────────────

function PlayerLine({
  player,
  skin,
  holder,
  subtitle,
  fallbackTeam,
  holderTeam,
  busy,
  locked,
  onGive,
  onTake,
}: {
  player: SkinPlayer;
  skin: SkinKey;
  holder: SkinHolder | undefined;
  subtitle: string | null;
  /** Team whose logo the normal mini card shows. */
  fallbackTeam: SkinTeam | null;
  /** Team on the skin card, when the player holds it. */
  holderTeam: SkinTeam | null;
  busy: boolean;
  locked: boolean;
  onGive: () => void;
  onTake: () => void;
}) {
  const { Mini } = SKIN_CARDS[skin];
  return (
    <li
      className={`flex items-center gap-3 rounded-xl px-2 py-2 transition-colors ${
        holder ? "bg-[#D4AF37]/10 ring-1 ring-[#D4AF37]/30" : "hover:bg-white/[0.03]"
      }`}
    >
      <span className="w-10 shrink-0">
        {holder ? (
          <Framed framing={holder.framing}>
            <Mini photo={player.photo} logo={holderTeam?.logo ?? null} initial={initialOf(player)} />
          </Framed>
        ) : (
          <MiniCard photo={player.photo} logo={fallbackTeam?.logo ?? null} initial={initialOf(player)} />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{fullName(player)}</span>
        {subtitle && <span className="block truncate text-xs text-white/50">{subtitle}</span>}
      </span>
      {holder ? (
        <button type="button" onClick={onTake} disabled={busy || locked} className={takeButton}>
          Αφαίρεση
        </button>
      ) : (
        <button type="button" onClick={onGive} disabled={busy || locked} className={giveButton}>
          Απονομή
        </button>
      )}
    </li>
  );
}

// ───────────────────────────────────────────────────────────────────────
// One holder's big card with the framing editor
// ───────────────────────────────────────────────────────────────────────

function HolderFigure({
  player,
  skin,
  holder,
  team,
  teamChoices,
  editing,
  draft,
  saving,
  locked,
  onEdit,
  onDraft,
  onCancel,
  onSave,
  onTeam,
  onTake,
}: {
  player: SkinPlayer;
  skin: SkinKey;
  holder: SkinHolder;
  team: SkinTeam | null;
  teamChoices: { id: number; label: string }[];
  editing: boolean;
  draft: CardFraming | null;
  saving: boolean;
  locked: boolean;
  onEdit: () => void;
  onDraft: (next: CardFraming) => void;
  onCancel: () => void;
  onSave: () => void;
  onTeam: (teamId: number | null) => void;
  onTake: () => void;
}) {
  const { Big, Mini } = SKIN_CARDS[skin];
  const framing = editing && draft ? draft : holder.framing;
  const framed = !sameFraming(holder.framing, DEFAULT_FRAMING);
  return (
    <figure className="w-[calc(300px*var(--card-scale))]">
      <div className="relative">
        <Sized>
          <Framed framing={framing}>
            <Big
              first={player.first}
              last={player.last}
              photo={player.photo}
              team={toDirectoryTeam(team)}
              stats={player.stats}
              intro={false}
            />
          </Framed>
        </Sized>
        {editing && <PhotoDragLayer framing={framing} onChange={onDraft} />}
      </div>
      <figcaption className="mt-3 flex items-center gap-3 text-[13px] text-white/70">
        <span className="w-10 shrink-0 md:w-12">
          <Framed framing={framing}>
            <Mini photo={player.photo} logo={team?.logo ?? null} initial={initialOf(player)} />
          </Framed>
        </span>
        <span className="min-w-0">
          <span className="block truncate font-semibold text-white">{fullName(player)}</span>
          {team && <span className="block truncate text-white/50">{team.name}</span>}
        </span>
      </figcaption>

      {editing ? (
        <div className={saving ? "pointer-events-none opacity-60" : undefined}>
          <FramingControls
            framing={framing}
            changed={!sameFraming(framing, DEFAULT_FRAMING)}
            onChange={onDraft}
            onReset={() => onDraft(DEFAULT_FRAMING)}
            onDone={onSave}
          />
          <button type="button" onClick={onCancel} className="mt-2 text-[13px] text-white/50 underline hover:text-white">
            Ακύρωση
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {player.hasPhoto && (
            <button type="button" onClick={onEdit} disabled={locked} className={`${quietButton} inline-flex items-center gap-2`}>
              {/* A gold dot marks a card that already has its own framing. */}
              {framed && <span aria-hidden className="h-2 w-2 rounded-full bg-[#D4AF37]" />}
              Προσαρμογή
            </button>
          )}
          <button type="button" onClick={onTake} disabled={locked || saving} className={takeButton}>
            Αφαίρεση
          </button>
          <select
            aria-label="Ομάδα στην κάρτα"
            value={holder.teamId ?? ""}
            disabled={locked || saving}
            onChange={(e) => onTeam(e.target.value === "" ? null : Number(e.target.value))}
            className="min-w-0 max-w-full flex-1 basis-full rounded-full border border-white/15 bg-zinc-950 px-3 py-1 text-[13px] text-white/80 focus:border-[#D4AF37] focus:outline-none"
          >
            <option value="">— χωρίς ομάδα —</option>
            {teamChoices.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}
    </figure>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The page
// ───────────────────────────────────────────────────────────────────────

export default function ProtathlitesClient({
  seasons,
  teams,
  players,
  holders: initialHolders,
}: {
  seasons: SkinSeason[];
  teams: SkinTeam[];
  players: SkinPlayer[];
  /** null = the table does not exist yet (migration not run). */
  holders: SkinHolder[] | null;
}) {
  const available = initialHolders !== null;
  const [skin, setSkin] = useState<SkinKey>(CARD_SKINS[0].key);
  const [holders, setHolders] = useState<Map<string, SkinHolder>>(
    () => new Map((initialHolders ?? []).map((h) => [holderKey(h.playerId, h.skin), h] as const)),
  );
  const [busy, setBusy] = useState<Set<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<"teams" | "players">("teams");
  const seasonsWithTeams = useMemo(() => {
    const used = new Set(teams.map((t) => t.season ?? NO_SEASON));
    const list = seasons.filter((s) => used.has(s.label)).map((s) => ({ label: s.label, display: s.display, active: s.active }));
    if (used.has(NO_SEASON)) list.push({ label: NO_SEASON, display: "Χωρίς σεζόν", active: false });
    return list;
  }, [seasons, teams]);
  const [season, setSeason] = useState<string>(
    () => seasonsWithTeams.find((s) => s.active)?.label ?? seasonsWithTeams[0]?.label ?? NO_SEASON,
  );
  const [teamId, setTeamId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [cardQuery, setCardQuery] = useState("");
  const [shown, setShown] = useState(STEP);
  const [editing, setEditing] = useState<{ playerId: number; draft: CardFraming } | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);
  const rosterPanel = useRef<HTMLDivElement>(null);

  // On a narrow screen the roster opens below the team list: bring it into view.
  useEffect(() => {
    if (teamId == null || window.innerWidth >= 1024) return;
    rosterPanel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [teamId]);

  const teamsById = useMemo(() => new Map(teams.map((t) => [t.id, t] as const)), [teams]);
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p] as const)), [players]);
  const seasonDisplay = useMemo(() => new Map(seasons.map((s) => [s.label, s.display] as const)), [seasons]);
  const rosterByTeam = useMemo(() => {
    const map = new Map<number, SkinPlayer[]>();
    for (const p of players) {
      for (const id of p.teamIds) {
        const list = map.get(id) ?? [];
        list.push(p);
        map.set(id, list);
      }
    }
    return map;
  }, [players]);

  const teamLabel = (t: SkinTeam) => (t.season ? `${t.name} · ${seasonDisplay.get(t.season) ?? t.season}` : t.name);
  const holderOf = (playerId: number) => holders.get(holderKey(playerId, skin));

  const countBySkin = useMemo(() => {
    const counts = new Map<SkinKey, number>();
    for (const h of holders.values()) counts.set(h.skin, (counts.get(h.skin) ?? 0) + 1);
    return counts;
  }, [holders]);

  // Holders of the current skin, by name, filtered by the cards' search box.
  const skinHolders = useMemo(() => {
    const q = foldText(cardQuery);
    return [...holders.values()]
      .filter((h) => h.skin === skin)
      .map((h) => ({ holder: h, player: playersById.get(h.playerId) }))
      .filter((x): x is { holder: SkinHolder; player: SkinPlayer } => x.player !== undefined)
      .filter((x) => !q || foldText(`${x.player.first} ${x.player.last} ${x.player.id}`).includes(q))
      .sort((a, b) => fullName(a.player).localeCompare(fullName(b.player), "el"));
  }, [holders, skin, playersById, cardQuery]);
  const skinTotal = countBySkin.get(skin) ?? 0;

  // A new skin or card search starts the wall again from the top.
  useEffect(() => {
    setShown(STEP);
    setEditing(null);
  }, [skin, cardQuery]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setShown((n) => n + STEP);
      },
      { rootMargin: "800px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [skinHolders, shown]);

  // ── writes ──────────────────────────────────────────────────────────

  function markBusy(ids: number[], on: boolean) {
    setBusy((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  async function give(list: { player: SkinPlayer; teamId: number | null }[]) {
    const current = skin;
    const todo = list.filter((x) => !holders.has(holderKey(x.player.id, current)));
    if (todo.length === 0) return;
    const ids = todo.map((x) => x.player.id);
    setError(null);
    setHolders((prev) => {
      const next = new Map(prev);
      for (const x of todo) {
        next.set(holderKey(x.player.id, current), {
          playerId: x.player.id,
          skin: current,
          teamId: x.teamId,
          framing: DEFAULT_FRAMING,
        });
      }
      return next;
    });
    markBusy(ids, true);
    const res = await giveSkin({ skin: current, players: todo.map((x) => ({ playerId: x.player.id, teamId: x.teamId })) });
    setHolders((prev) => {
      const next = new Map(prev);
      if (!res.success) {
        for (const id of ids) next.delete(holderKey(id, current));
      } else {
        for (const h of res.data) next.set(holderKey(h.playerId, h.skin), h);
      }
      return next;
    });
    if (!res.success) setError(res.error);
    markBusy(ids, false);
  }

  async function take(ids: number[], confirmText?: string) {
    const current = skin;
    const removed = ids
      .map((id) => holders.get(holderKey(id, current)))
      .filter((h): h is SkinHolder => h !== undefined);
    if (removed.length === 0) return;
    const losesFraming = removed.some((h) => !sameFraming(h.framing, DEFAULT_FRAMING));
    const ask = confirmText ?? (losesFraming ? "Η προσαρμογή της φωτογραφίας θα χαθεί. Αφαίρεση της κάρτας;" : null);
    if (ask && !window.confirm(ask)) return;

    const removedIds = removed.map((h) => h.playerId);
    setError(null);
    if (editing && removedIds.includes(editing.playerId)) setEditing(null);
    setHolders((prev) => {
      const next = new Map(prev);
      for (const id of removedIds) next.delete(holderKey(id, current));
      return next;
    });
    markBusy(removedIds, true);
    const res = await takeSkin({ skin: current, playerIds: removedIds });
    if (!res.success) {
      setHolders((prev) => {
        const next = new Map(prev);
        for (const h of removed) next.set(holderKey(h.playerId, h.skin), h);
        return next;
      });
      setError(res.error);
    }
    markBusy(removedIds, false);
  }

  async function saveCard(playerId: number, patch: { framing?: CardFraming; teamId?: number | null }) {
    const current = skin;
    setError(null);
    setSavingId(playerId);
    const res = await updateSkinCard({ skin: current, playerId, ...patch });
    setSavingId(null);
    if (!res.success) {
      setError(res.error);
      return false;
    }
    setHolders((prev) => new Map(prev).set(holderKey(res.data.playerId, res.data.skin), res.data));
    return true;
  }

  async function finishFraming() {
    if (!editing) return;
    const holder = holderOf(editing.playerId);
    if (!holder) return setEditing(null);
    if (sameFraming(holder.framing, editing.draft)) return setEditing(null);
    if (await saveCard(editing.playerId, { framing: editing.draft })) setEditing(null);
  }

  // ── derived lists for the assignment panes ─────────────────────────

  const seasonTeams = useMemo(
    () => teams.filter((t) => (t.season ?? NO_SEASON) === season),
    [teams, season],
  );
  const selectedTeam = teamId != null ? (teamsById.get(teamId) ?? null) : null;
  const roster = useMemo(
    () =>
      selectedTeam
        ? [...(rosterByTeam.get(selectedTeam.id) ?? [])].sort((a, b) => fullName(a).localeCompare(fullName(b), "el"))
        : [],
    [selectedTeam, rosterByTeam],
  );
  const rosterHolders = roster.filter((p) => holderOf(p.id)).length;

  const searchResults = useMemo(() => {
    const q = foldText(query);
    if (!q) return [];
    return players.filter((p) => {
      const team = p.mainTeamId != null ? teamsById.get(p.mainTeamId) : undefined;
      return foldText(`${p.first} ${p.last} ${team?.name ?? ""} ${p.id}`).includes(q);
    });
  }, [players, query, teamsById]);

  const locked = !available;
  const skinLabel = CARD_SKINS.find((s) => s.key === skin)?.label ?? skin;

  const lineFor = (player: SkinPlayer, viaTeam: SkinTeam | null) => {
    const holder = holderOf(player.id);
    const mainTeam = player.mainTeamId != null ? (teamsById.get(player.mainTeamId) ?? null) : null;
    const shownTeam = viaTeam ?? mainTeam;
    return (
      <PlayerLine
        key={player.id}
        player={player}
        skin={skin}
        holder={holder}
        subtitle={viaTeam ? null : mainTeam ? teamLabel(mainTeam) : null}
        fallbackTeam={shownTeam}
        holderTeam={holder?.teamId != null ? (teamsById.get(holder.teamId) ?? null) : null}
        busy={busy.has(player.id)}
        locked={locked}
        onGive={() => give([{ player, teamId: shownTeam?.id ?? null }])}
        onTake={() => take([player.id])}
      />
    );
  };

  return (
    <div className="space-y-6 [--card-scale:0.53] md:[--card-scale:1]">
      <FramingStyles />

      <header className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-semibold">Πρωταθλητές</h2>
        <div className="flex flex-wrap gap-2 sm:ml-auto">
          {CARD_SKINS.map((s) => (
            <Chip key={s.key} active={skin === s.key} onClick={() => setSkin(s.key)}>
              {s.label} <span className="tabular-nums opacity-70">{countBySkin.get(s.key) ?? 0}</span>
            </Chip>
          ))}
        </div>
      </header>

      {!available && (
        <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Ο πίνακας <code className="font-mono">player_card_skins</code> δεν υπάρχει ακόμη. Τρέξτε το{" "}
          <code className="font-mono">migrations/add-player-card-skins.sql</code> στη Supabase.
        </div>
      )}

      {/* ── Assignment ─────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-zinc-950 p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Chip active={mode === "teams"} onClick={() => setMode("teams")}>
            Ομάδες
          </Chip>
          <Chip active={mode === "players"} onClick={() => setMode("players")}>
            Παίκτες
          </Chip>
        </div>

        {mode === "teams" ? (
          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            {/* On wide screens the team list stays in view while a long roster scrolls. */}
            <div className="min-w-0 lg:sticky lg:top-20 lg:self-start">
              <div className="flex flex-wrap gap-2">
                {seasonsWithTeams.map((s) => (
                  <Chip
                    key={s.label}
                    active={season === s.label}
                    onClick={() => {
                      setSeason(s.label);
                      setTeamId(null);
                    }}
                  >
                    {s.display}
                  </Chip>
                ))}
              </div>
              <ul className="mt-3 grid max-h-[28rem] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">
                {seasonTeams.map((t) => {
                  const size = rosterByTeam.get(t.id)?.length ?? 0;
                  const held = (rosterByTeam.get(t.id) ?? []).filter((p) => holderOf(p.id)).length;
                  const active = t.id === teamId;
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setTeamId(active ? null : t.id)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-sm transition-colors ${
                          active ? "border-[#D4AF37] bg-[#D4AF37]/10" : "border-white/10 hover:border-white/30"
                        } ${t.archived ? "opacity-60" : ""}`}
                      >
                        <TeamLogo team={t} />
                        <span className="min-w-0 flex-1 truncate">{t.name}</span>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums ${
                            held > 0 ? "bg-[#D4AF37] font-semibold text-[#0a0a14]" : "bg-white/5 text-white/50"
                          }`}
                        >
                          {held}/{size}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="min-w-0">
              {selectedTeam ? (
                <div ref={rosterPanel} className="scroll-mt-20 rounded-xl border border-white/10 bg-black/40 p-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <TeamLogo team={selectedTeam} size="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">{selectedTeam.name}</div>
                      <div className="text-xs tabular-nums text-white/50">
                        {selectedTeam.season ? (seasonDisplay.get(selectedTeam.season) ?? selectedTeam.season) : "—"} ·{" "}
                        {rosterHolders}/{roster.length}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={locked || roster.length === 0 || rosterHolders === roster.length}
                      onClick={() => give(roster.map((player) => ({ player, teamId: selectedTeam.id })))}
                      className={giveButton}
                    >
                      Σε όλη την ομάδα
                    </button>
                    <button
                      type="button"
                      disabled={locked || rosterHolders === 0}
                      onClick={() =>
                        take(
                          roster.map((p) => p.id),
                          `Αφαίρεση της κάρτας «${skinLabel}» από ${rosterHolders} ${
                            rosterHolders === 1 ? "παίκτη" : "παίκτες"
                          } της ομάδας «${selectedTeam.name}»;`,
                        )
                      }
                      className={takeButton}
                    >
                      Αφαίρεση από όλους
                    </button>
                  </div>
                  {roster.length === 0 ? (
                    <p className="mt-4 text-sm text-white/50">Η ομάδα δεν έχει παίκτες.</p>
                  ) : (
                    <ul className="mt-3 space-y-1">{roster.map((p) => lineFor(p, selectedTeam))}</ul>
                  )}
                </div>
              ) : (
                <div className="hidden h-full min-h-[8rem] place-items-center rounded-xl border border-dashed border-white/10 text-sm text-white/40 lg:grid">
                  Επιλέξτε ομάδα
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Αναζήτηση παίκτη"
              aria-label="Αναζήτηση παίκτη"
              autoFocus
              className="w-full rounded-full border border-white/15 bg-transparent px-4 py-2 text-sm placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none sm:max-w-sm"
            />
            {query.trim() !== "" && searchResults.length === 0 && (
              <p className="mt-4 text-sm text-white/50">Δεν βρέθηκαν παίκτες.</p>
            )}
            {searchResults.length > 0 && (
              <ul className="mt-3 grid gap-1 lg:grid-cols-2">
                {searchResults.slice(0, SEARCH_LIMIT).map((p) => lineFor(p, null))}
              </ul>
            )}
            {searchResults.length > SEARCH_LIMIT && (
              <p className="mt-3 text-xs tabular-nums text-white/40">
                +{searchResults.length - SEARCH_LIMIT}
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── The cards ──────────────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-lg font-semibold">
            «{skinLabel}» <span className="tabular-nums text-white/50">{skinTotal}</span>
          </h3>
          {skinTotal > STEP && (
            <input
              type="search"
              value={cardQuery}
              onChange={(e) => setCardQuery(e.target.value)}
              placeholder="Αναζήτηση"
              aria-label="Αναζήτηση στις κάρτες"
              className="ml-auto w-full rounded-full border border-white/15 bg-transparent px-4 py-1.5 text-sm placeholder:text-white/40 focus:border-[#D4AF37] focus:outline-none sm:w-56"
            />
          )}
        </div>

        {skinHolders.length === 0 ? (
          <p className="mt-6 text-sm text-white/40">—</p>
        ) : (
          <div className="mt-6 flex flex-wrap justify-center gap-x-4 gap-y-10 md:justify-start md:gap-x-10">
            {skinHolders.slice(0, shown).map(({ holder, player }) => {
              const team = holder.teamId != null ? (teamsById.get(holder.teamId) ?? null) : null;
              const choiceIds = new Set(player.teamIds);
              if (holder.teamId != null) choiceIds.add(holder.teamId);
              const teamChoices = [...choiceIds]
                .map((id) => teamsById.get(id))
                .filter((t): t is SkinTeam => t !== undefined)
                .map((t) => ({ id: t.id, label: teamLabel(t) }));
              const isEditing = editing?.playerId === player.id;
              return (
                <HolderFigure
                  key={player.id}
                  player={player}
                  skin={skin}
                  holder={holder}
                  team={team}
                  teamChoices={teamChoices}
                  editing={isEditing}
                  draft={isEditing ? editing.draft : null}
                  saving={savingId === player.id || busy.has(player.id)}
                  locked={locked}
                  onEdit={() => setEditing({ playerId: player.id, draft: holder.framing })}
                  onDraft={(draft) => setEditing({ playerId: player.id, draft })}
                  onCancel={() => setEditing(null)}
                  onSave={finishFraming}
                  onTeam={(id) => saveCard(player.id, { teamId: id })}
                  onTake={() => take([player.id])}
                />
              );
            })}
          </div>
        )}
        {shown < skinHolders.length && <div ref={sentinel} aria-hidden className="h-10" />}
      </section>

      {error && (
        <div
          role="alert"
          className="fixed inset-x-4 bottom-4 z-50 flex items-start gap-3 rounded-xl border border-red-400/40 bg-red-950/95 px-4 py-3 text-sm text-red-100 shadow-lg sm:left-auto sm:max-w-md"
        >
          <span className="min-w-0 flex-1">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Κλείσιμο" className="text-red-200 hover:text-white">
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
