"use client";

/**
 * FormationBuilder — FIFA-style lineup creator.
 * Pick a formation, tap a slot, tap a player to assign. Drag also works.
 */

import React, { useMemo, useState, useCallback } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTimes,
  FaRedo,
  FaMagic,
  FaUserAlt,
  FaFutbol,
} from "react-icons/fa";

// ───────────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────────

export type FBPlayer = {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  position: string | null;
  photoUrl: string;
};

type SlotRole = "GK" | "DEF" | "MID" | "FWD";

type Slot = {
  id: string;
  role: SlotRole;
  label: string;
  x: number; // 0..100 (left %)
  y: number; // 0..100 (top %, 0 = opponent goal)
};

type FormationDef = {
  key: string;
  name: string;
  slots: Slot[];
};

// ───────────────────────────────────────────────────────────────────────
// Formations (attacking UP → GK at bottom, strikers at top)
// ───────────────────────────────────────────────────────────────────────

const FORMATIONS: FormationDef[] = [
  {
    key: "4-4-2",
    name: "4-4-2",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "lb", role: "DEF", label: "LB", x: 14, y: 72 },
      { id: "cb1", role: "DEF", label: "CB", x: 37, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 63, y: 76 },
      { id: "rb", role: "DEF", label: "RB", x: 86, y: 72 },
      { id: "lm", role: "MID", label: "LM", x: 14, y: 48 },
      { id: "cm1", role: "MID", label: "CM", x: 37, y: 52 },
      { id: "cm2", role: "MID", label: "CM", x: 63, y: 52 },
      { id: "rm", role: "MID", label: "RM", x: 86, y: 48 },
      { id: "st1", role: "FWD", label: "ST", x: 37, y: 22 },
      { id: "st2", role: "FWD", label: "ST", x: 63, y: 22 },
    ],
  },
  {
    key: "4-3-3",
    name: "4-3-3",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "lb", role: "DEF", label: "LB", x: 14, y: 72 },
      { id: "cb1", role: "DEF", label: "CB", x: 37, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 63, y: 76 },
      { id: "rb", role: "DEF", label: "RB", x: 86, y: 72 },
      { id: "cm1", role: "MID", label: "CM", x: 28, y: 52 },
      { id: "cm2", role: "MID", label: "CM", x: 50, y: 55 },
      { id: "cm3", role: "MID", label: "CM", x: 72, y: 52 },
      { id: "lw", role: "FWD", label: "LW", x: 16, y: 22 },
      { id: "st", role: "FWD", label: "ST", x: 50, y: 18 },
      { id: "rw", role: "FWD", label: "RW", x: 84, y: 22 },
    ],
  },
  {
    key: "3-5-2",
    name: "3-5-2",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "cb1", role: "DEF", label: "CB", x: 25, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 50, y: 78 },
      { id: "cb3", role: "DEF", label: "CB", x: 75, y: 76 },
      { id: "lwb", role: "MID", label: "LWB", x: 10, y: 54 },
      { id: "cm1", role: "MID", label: "CM", x: 32, y: 52 },
      { id: "cm2", role: "MID", label: "CM", x: 50, y: 55 },
      { id: "cm3", role: "MID", label: "CM", x: 68, y: 52 },
      { id: "rwb", role: "MID", label: "RWB", x: 90, y: 54 },
      { id: "st1", role: "FWD", label: "ST", x: 37, y: 20 },
      { id: "st2", role: "FWD", label: "ST", x: 63, y: 20 },
    ],
  },
  {
    key: "4-2-3-1",
    name: "4-2-3-1",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "lb", role: "DEF", label: "LB", x: 14, y: 72 },
      { id: "cb1", role: "DEF", label: "CB", x: 37, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 63, y: 76 },
      { id: "rb", role: "DEF", label: "RB", x: 86, y: 72 },
      { id: "cdm1", role: "MID", label: "CDM", x: 37, y: 58 },
      { id: "cdm2", role: "MID", label: "CDM", x: 63, y: 58 },
      { id: "lam", role: "MID", label: "LAM", x: 18, y: 36 },
      { id: "cam", role: "MID", label: "CAM", x: 50, y: 38 },
      { id: "ram", role: "MID", label: "RAM", x: 82, y: 36 },
      { id: "st", role: "FWD", label: "ST", x: 50, y: 16 },
    ],
  },
  {
    key: "5-3-2",
    name: "5-3-2",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "lwb", role: "DEF", label: "LWB", x: 10, y: 68 },
      { id: "cb1", role: "DEF", label: "CB", x: 30, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 50, y: 78 },
      { id: "cb3", role: "DEF", label: "CB", x: 70, y: 76 },
      { id: "rwb", role: "DEF", label: "RWB", x: 90, y: 68 },
      { id: "cm1", role: "MID", label: "CM", x: 28, y: 48 },
      { id: "cm2", role: "MID", label: "CM", x: 50, y: 50 },
      { id: "cm3", role: "MID", label: "CM", x: 72, y: 48 },
      { id: "st1", role: "FWD", label: "ST", x: 37, y: 20 },
      { id: "st2", role: "FWD", label: "ST", x: 63, y: 20 },
    ],
  },
  {
    key: "4-1-4-1",
    name: "4-1-4-1",
    slots: [
      { id: "gk", role: "GK", label: "GK", x: 50, y: 92 },
      { id: "lb", role: "DEF", label: "LB", x: 14, y: 72 },
      { id: "cb1", role: "DEF", label: "CB", x: 37, y: 76 },
      { id: "cb2", role: "DEF", label: "CB", x: 63, y: 76 },
      { id: "rb", role: "DEF", label: "RB", x: 86, y: 72 },
      { id: "cdm", role: "MID", label: "CDM", x: 50, y: 60 },
      { id: "lm", role: "MID", label: "LM", x: 14, y: 40 },
      { id: "cm1", role: "MID", label: "CM", x: 37, y: 44 },
      { id: "cm2", role: "MID", label: "CM", x: 63, y: 44 },
      { id: "rm", role: "MID", label: "RM", x: 86, y: 40 },
      { id: "st", role: "FWD", label: "ST", x: 50, y: 18 },
    ],
  },
];

// ───────────────────────────────────────────────────────────────────────
// Helpers
// ───────────────────────────────────────────────────────────────────────

const normalizePos = (raw: string | null | undefined): SlotRole | null => {
  if (!raw) return null;
  const v = raw.trim().toUpperCase();
  if (v === "GK" || v.includes("GOAL")) return "GK";
  if (
    v === "DEF" ||
    v === "CB" ||
    v === "LB" ||
    v === "RB" ||
    v === "LWB" ||
    v === "RWB" ||
    v === "DF" ||
    v.includes("DEF") ||
    v.includes("BACK")
  )
    return "DEF";
  if (
    v === "MID" ||
    v === "CM" ||
    v === "CDM" ||
    v === "CAM" ||
    v === "LM" ||
    v === "RM" ||
    v === "MF" ||
    v.includes("MID")
  )
    return "MID";
  if (
    v === "FWD" ||
    v === "ST" ||
    v === "CF" ||
    v === "LW" ||
    v === "RW" ||
    v.includes("FWD") ||
    v.includes("FORW") ||
    v.includes("STRI") ||
    v.includes("WING")
  )
    return "FWD";
  return null;
};

const lastNameOrFull = (p: FBPlayer) =>
  (p.lastName || p.fullName || "").trim() || "—";

// ───────────────────────────────────────────────────────────────────────
// Pitch background (SVG)
// ───────────────────────────────────────────────────────────────────────

const PitchSVG: React.FC<{ accent: string }> = ({ accent }) => (
  <svg
    className="absolute inset-0 h-full w-full"
    viewBox="0 0 100 140"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <defs>
      {/* Grass noise — turbulence filter for realistic turf */}
      <filter id="fb-grass" x="0" y="0" width="100%" height="100%">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="2.8"
          numOctaves="2"
          seed="5"
          result="noise"
        />
        <feColorMatrix
          in="noise"
          type="matrix"
          values="0 0 0 0 0.05
                  0 0 0 0 0.18
                  0 0 0 0 0.08
                  0 0 0 0.7 0"
          result="tinted"
        />
        <feComposite in="tinted" in2="SourceGraphic" operator="in" />
      </filter>

      {/* Stripe pattern: alternating light/dark mowed bands */}
      <pattern
        id="fb-stripes"
        x="0"
        y="0"
        width="100"
        height="20"
        patternUnits="userSpaceOnUse"
      >
        <rect width="100" height="10" fill="#1f4b2d" />
        <rect y="10" width="100" height="10" fill="#174022" />
      </pattern>

      {/* Subtle radial vignette for depth */}
      <radialGradient id="fb-vignette" cx="50%" cy="50%" r="70%">
        <stop offset="0" stopColor="#000" stopOpacity="0" />
        <stop offset="0.7" stopColor="#000" stopOpacity="0" />
        <stop offset="1" stopColor="#000" stopOpacity="0.55" />
      </radialGradient>

      {/* White line style — slightly soft */}
      <filter id="fb-line-soft" x="-5%" y="-5%" width="110%" height="110%">
        <feGaussianBlur stdDeviation="0.08" />
      </filter>
    </defs>

    {/* Base turf: stripe pattern */}
    <rect width="100" height="140" fill="url(#fb-stripes)" />

    {/* Grass texture overlay */}
    <rect width="100" height="140" fill="#1f4b2d" filter="url(#fb-grass)" opacity="0.9" />
    <rect width="100" height="140" fill="url(#fb-stripes)" opacity="0.55" />

    {/* Vignette */}
    <rect width="100" height="140" fill="url(#fb-vignette)" />

    {/* All field markings — crisp white */}
    <g
      fill="none"
      stroke="#f5f3ea"
      strokeWidth="0.45"
      strokeOpacity="0.95"
      filter="url(#fb-line-soft)"
    >
      {/* Outer boundary */}
      <rect x="3" y="3" width="94" height="134" />

      {/* Midline */}
      <line x1="3" y1="70" x2="97" y2="70" />

      {/* Center circle */}
      <circle cx="50" cy="70" r="9" />

      {/* Top (opponent) penalty area */}
      <rect x="22" y="3" width="56" height="16" />
      <rect x="34" y="3" width="32" height="6" />
      <path d="M 41 19 A 9 9 0 0 0 59 19" />

      {/* Bottom (own) penalty area */}
      <rect x="22" y="121" width="56" height="16" />
      <rect x="34" y="131" width="32" height="6" />
      <path d="M 41 121 A 9 9 0 0 1 59 121" />

      {/* Corner arcs */}
      <path d="M 3 6 A 3 3 0 0 0 6 3" />
      <path d="M 94 3 A 3 3 0 0 0 97 6" />
      <path d="M 97 134 A 3 3 0 0 0 94 137" />
      <path d="M 6 137 A 3 3 0 0 0 3 134" />
    </g>

    {/* Spots (filled, no blur) */}
    <g fill="#f5f3ea" fillOpacity="0.95">
      <circle cx="50" cy="70" r="0.6" />
      <circle cx="50" cy="14" r="0.6" />
      <circle cx="50" cy="126" r="0.6" />
    </g>

    {/* Accent midline glow (team color) */}
    <line
      x1="3"
      y1="70"
      x2="97"
      y2="70"
      stroke={accent}
      strokeOpacity="0.25"
      strokeWidth="0.8"
    />
  </svg>
);

const PitchPhoto: React.FC<{ src: string }> = ({ src }) => (
  <>
    <Image
      src={src}
      alt="Football pitch"
      fill
      className="object-cover"
      sizes="(max-width: 1024px) 100vw, 60vw"
      priority={false}
    />
    <div className="absolute inset-0 bg-[#0a0a14]/25" />
  </>
);

// ───────────────────────────────────────────────────────────────────────
// Position slot (on pitch)
// ───────────────────────────────────────────────────────────────────────

const PositionSlot: React.FC<{
  slot: Slot;
  player: FBPlayer | null;
  accent: string;
  focused: boolean;
  highlight: boolean;
  onClick: () => void;
  onRemove: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
}> = ({
  slot,
  player,
  accent,
  focused,
  highlight,
  onClick,
  onRemove,
  onDragOver,
  onDrop,
  onDragStart,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragStart={onDragStart}
      draggable={!!player}
      className="absolute -translate-x-1/2 -translate-y-1/2 focus:outline-none"
      style={{
        left: `${slot.x}%`,
        top: `${slot.y}%`,
      }}
      aria-label={`${slot.label}${player ? `: ${player.fullName}` : " (empty)"}`}
    >
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 22 }}
        className="relative flex flex-col items-center"
        style={{ filter: focused ? `drop-shadow(0 0 12px ${accent})` : undefined }}
      >
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-full border-2 transition-all"
          style={{
            width: "clamp(38px, 7vw, 62px)",
            height: "clamp(38px, 7vw, 62px)",
            borderColor: player ? accent : focused ? accent : "rgba(243,239,230,0.55)",
            borderStyle: player ? "solid" : focused ? "solid" : "dashed",
            background: player
              ? "#0a0a14"
              : focused
                ? `${accent}22`
                : "rgba(10,10,20,0.55)",
            boxShadow: highlight
              ? `0 0 0 3px ${accent}`
              : focused
                ? `0 0 0 2px ${accent}`
                : "none",
          }}
        >
          {player ? (
            player.photoUrl ? (
              <Image
                src={player.photoUrl}
                alt={player.fullName}
                fill
                className="object-cover"
                sizes="64px"
              />
            ) : (
              <FaUserAlt
                className="opacity-70"
                style={{ color: "#F3EFE6", fontSize: "clamp(14px, 2vw, 22px)" }}
              />
            )
          ) : (
            <span
              className="font-[var(--f-mono)] text-[10px] font-bold tracking-[0.12em]"
              style={{ color: "rgba(243,239,230,0.9)" }}
            >
              {slot.label}
            </span>
          )}

          {player && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.stopPropagation();
                  onRemove();
                }
              }}
              className="absolute -right-1 -top-1 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full bg-[#0a0a14] text-[#F3EFE6] opacity-0 ring-1 ring-[#F3EFE6]/60 transition-opacity hover:opacity-100 group-hover:opacity-100"
              style={{
                opacity: focused ? 1 : undefined,
              }}
              aria-label="Remove player"
            >
              <FaTimes className="text-[8px]" />
            </span>
          )}
        </div>

        <div
          className="mt-1 whitespace-nowrap rounded-[3px] px-1.5 py-[2px] font-[var(--f-mono)] text-[9px] font-bold uppercase tracking-[0.15em]"
          style={{
            background: player ? "#0a0a14" : "rgba(10,10,20,0.7)",
            color: player ? accent : "rgba(243,239,230,0.75)",
            border: `1px solid ${player ? accent : "rgba(243,239,230,0.25)"}`,
            maxWidth: "min(120px, 22vw)",
          }}
        >
          <span className="block overflow-hidden text-ellipsis">
            {player ? lastNameOrFull(player) : slot.label}
          </span>
        </div>
      </motion.div>
    </button>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Bench (roster sidebar)
// ───────────────────────────────────────────────────────────────────────

const BenchCard: React.FC<{
  player: FBPlayer;
  selected: boolean;
  accent: string;
  onClick: () => void;
  onDragStart: (e: React.DragEvent) => void;
}> = ({ player, selected, accent, onClick, onDragStart }) => {
  const role = normalizePos(player.position);
  const roleLabel = role ?? "—";
  return (
    <button
      type="button"
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      className="group flex w-full items-center gap-3 rounded-[4px] border px-2.5 py-2 text-left transition-all"
      style={{
        borderColor: selected ? accent : "rgba(243,239,230,0.15)",
        background: selected ? `${accent}12` : "rgba(10,10,20,0.5)",
        boxShadow: selected ? `3px 3px 0 0 ${accent}` : "none",
      }}
    >
      <div
        className="relative h-9 w-9 flex-none overflow-hidden rounded-full border"
        style={{ borderColor: selected ? accent : "rgba(243,239,230,0.25)" }}
      >
        {player.photoUrl ? (
          <Image
            src={player.photoUrl}
            alt={player.fullName}
            fill
            className="object-cover"
            sizes="40px"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#0a0a14]">
            <FaUserAlt className="text-[12px] text-[#F3EFE6]/50" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-[var(--f-body)] text-sm font-semibold text-[#F3EFE6]">
          {player.fullName}
        </div>
        <div className="font-[var(--f-mono)] text-[10px] uppercase tracking-[0.2em] text-[#F3EFE6]/55">
          {roleLabel}
        </div>
      </div>
      <span
        className="flex-none font-[var(--f-mono)] text-[10px] font-bold uppercase tracking-[0.15em]"
        style={{ color: selected ? accent : "rgba(243,239,230,0.35)" }}
      >
        {selected ? "SEL" : "+"}
      </span>
    </button>
  );
};

// ───────────────────────────────────────────────────────────────────────
// Main component
// ───────────────────────────────────────────────────────────────────────

const FormationBuilder: React.FC<{
  players: FBPlayer[];
  accent: string;
  teamName?: string;
  /** Optional top-down pitch image (e.g. "/pitch.jpg"). Falls back to SVG turf. */
  pitchImage?: string;
}> = ({ players, accent, teamName, pitchImage }) => {
  const [formationKey, setFormationKey] = useState<string>(FORMATIONS[0].key);
  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [focusedSlot, setFocusedSlot] = useState<string | null>(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState<number | null>(null);
  const [query, setQuery] = useState("");

  const formation = useMemo(
    () => FORMATIONS.find((f) => f.key === formationKey) ?? FORMATIONS[0],
    [formationKey]
  );

  const playerById = useMemo(() => {
    const m = new Map<number, FBPlayer>();
    for (const p of players) m.set(p.id, p);
    return m;
  }, [players]);

  const assignedIds = useMemo(
    () => new Set(Object.values(assignments)),
    [assignments]
  );

  const benchPlayers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return players
      .filter((p) => !assignedIds.has(p.id))
      .filter((p) =>
        q.length === 0 ? true : p.fullName.toLowerCase().includes(q)
      );
  }, [players, assignedIds, query]);

  // ── Actions ──────────────────────────────────────────────────────────

  const assign = useCallback((slotId: string, playerId: number) => {
    setAssignments((prev) => {
      const next: Record<string, number> = {};
      // Remove this player from any other slot
      for (const [s, pid] of Object.entries(prev)) {
        if (pid !== playerId) next[s] = pid;
      }
      next[slotId] = playerId;
      return next;
    });
  }, []);

  const clearSlot = useCallback((slotId: string) => {
    setAssignments((prev) => {
      const next = { ...prev };
      delete next[slotId];
      return next;
    });
  }, []);

  const handleSlotClick = useCallback(
    (slotId: string) => {
      if (selectedPlayerId != null) {
        assign(slotId, selectedPlayerId);
        setSelectedPlayerId(null);
        setFocusedSlot(null);
        return;
      }
      // No selection — toggle focus
      setFocusedSlot((curr) => (curr === slotId ? null : slotId));
    },
    [assign, selectedPlayerId]
  );

  const handlePlayerPick = useCallback(
    (playerId: number) => {
      if (focusedSlot) {
        assign(focusedSlot, playerId);
        setFocusedSlot(null);
        setSelectedPlayerId(null);
        return;
      }
      setSelectedPlayerId((curr) => (curr === playerId ? null : playerId));
    },
    [assign, focusedSlot]
  );

  const handleClear = useCallback(() => {
    setAssignments({});
    setFocusedSlot(null);
    setSelectedPlayerId(null);
  }, []);

  const handleAutoFill = useCallback(() => {
    const buckets: Record<SlotRole, FBPlayer[]> = {
      GK: [],
      DEF: [],
      MID: [],
      FWD: [],
    };
    const unknown: FBPlayer[] = [];
    for (const p of players) {
      const r = normalizePos(p.position);
      if (r) buckets[r].push(p);
      else unknown.push(p);
    }

    const used = new Set<number>();
    const next: Record<string, number> = {};

    // First pass: fill by matching role
    for (const slot of formation.slots) {
      const pool = buckets[slot.role];
      const pick = pool.find((p) => !used.has(p.id));
      if (pick) {
        next[slot.id] = pick.id;
        used.add(pick.id);
      }
    }
    // Second pass: fill any empty slot with any leftover
    const allLeftover = [
      ...buckets.GK,
      ...buckets.DEF,
      ...buckets.MID,
      ...buckets.FWD,
      ...unknown,
    ].filter((p) => !used.has(p.id));
    for (const slot of formation.slots) {
      if (next[slot.id]) continue;
      const pick = allLeftover.shift();
      if (pick) {
        next[slot.id] = pick.id;
        used.add(pick.id);
      }
    }
    setAssignments(next);
    setFocusedSlot(null);
    setSelectedPlayerId(null);
  }, [players, formation]);

  // ── Drag handlers ────────────────────────────────────────────────────

  const onBenchDragStart = (playerId: number) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/fb-player", String(playerId));
    e.dataTransfer.effectAllowed = "move";
  };

  const onSlotDragStart = (slotId: string) => (e: React.DragEvent) => {
    const pid = assignments[slotId];
    if (!pid) return;
    e.dataTransfer.setData("text/fb-player", String(pid));
    e.dataTransfer.setData("text/fb-from-slot", slotId);
    e.dataTransfer.effectAllowed = "move";
  };

  const onSlotDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("text/fb-player")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const onSlotDrop = (slotId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("text/fb-player");
    const pid = Number(raw);
    if (!raw || Number.isNaN(pid)) return;
    const fromSlot = e.dataTransfer.getData("text/fb-from-slot");
    if (fromSlot && fromSlot !== slotId) {
      // Swap-aware: if target is filled, move its player to source slot.
      setAssignments((prev) => {
        const next = { ...prev };
        const targetPid = next[slotId];
        next[slotId] = pid;
        if (targetPid) next[fromSlot] = targetPid;
        else delete next[fromSlot];
        return next;
      });
    } else {
      assign(slotId, pid);
    }
    setFocusedSlot(null);
    setSelectedPlayerId(null);
  };

  const onBenchDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("text/fb-from-slot")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    }
  };

  const onBenchDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromSlot = e.dataTransfer.getData("text/fb-from-slot");
    if (fromSlot) clearSlot(fromSlot);
  };

  // ── Render ───────────────────────────────────────────────────────────

  const assignedCount = Object.keys(assignments).length;
  const totalSlots = formation.slots.length;

  return (
    <section className="relative mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 md:py-16">
      {/* Rubric header (matches page convention) */}
      <div className="mb-8 md:mb-10">
        <div
          className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: accent }}
        >
          <span className="h-[2px] w-8" style={{ background: accent }} />
          TACTICS / LINEUP
        </div>
        <div className="mt-3 flex flex-col items-start gap-1 border-b-2 border-[#F3EFE6]/20 pb-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <h2
            className="font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
            style={{ fontSize: "clamp(1.75rem, 4vw, 3rem)" }}
          >
            Formation Builder
          </h2>
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-[#F3EFE6]/60">
            {assignedCount}/{totalSlots} · {formation.name}
            {teamName ? ` · ${teamName}` : ""}
          </span>
        </div>
      </div>

      {/* Controls */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1.5 rounded-[4px] border border-[#F3EFE6]/15 bg-[#0a0a14]/60 p-1">
          {FORMATIONS.map((f) => {
            const active = f.key === formationKey;
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => setFormationKey(f.key)}
                className="rounded-[3px] px-2.5 py-1 font-[var(--f-mono)] text-[11px] font-bold tracking-[0.1em] transition-colors"
                style={{
                  background: active ? accent : "transparent",
                  color: active ? "#0a0a14" : "#F3EFE6",
                }}
              >
                {f.name}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleAutoFill}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[#F3EFE6]/20 bg-[#0a0a14]/60 px-3 py-1.5 font-[var(--f-mono)] text-[11px] font-bold uppercase tracking-[0.15em] text-[#F3EFE6] transition-colors hover:border-[var(--accent)]"
          style={{ ["--accent" as any]: accent }}
        >
          <FaMagic style={{ color: accent }} />
          Auto-fill
        </button>

        <button
          type="button"
          onClick={handleClear}
          className="inline-flex items-center gap-2 rounded-[4px] border border-[#F3EFE6]/20 bg-[#0a0a14]/60 px-3 py-1.5 font-[var(--f-mono)] text-[11px] font-bold uppercase tracking-[0.15em] text-[#F3EFE6] transition-colors hover:border-[#F3EFE6]/60"
        >
          <FaRedo />
          Clear
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Pitch */}
        <div
          className="relative w-full overflow-hidden rounded-[6px] border-2"
          style={{
            borderColor: "rgba(243,239,230,0.25)",
            boxShadow: `6px 6px 0 0 ${accent}`,
            aspectRatio: "5 / 7",
          }}
        >
          {pitchImage ? <PitchPhoto src={pitchImage} /> : <PitchSVG accent={accent} />}

          {/* Top-left badge */}
          <div
            className="pointer-events-none absolute left-3 top-3 z-10 rounded-[3px] border px-2 py-1 font-[var(--f-mono)] text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{
              borderColor: accent,
              background: "rgba(10,10,20,0.7)",
              color: accent,
            }}
          >
            {formation.name}
          </div>

          {/* Slots */}
          <AnimatePresence>
            {formation.slots.map((slot) => {
              const pid = assignments[slot.id];
              const player = pid ? playerById.get(pid) ?? null : null;
              return (
                <PositionSlot
                  key={`${formation.key}-${slot.id}`}
                  slot={slot}
                  player={player}
                  accent={accent}
                  focused={focusedSlot === slot.id}
                  highlight={
                    selectedPlayerId != null &&
                    player != null &&
                    player.id === selectedPlayerId
                  }
                  onClick={() => handleSlotClick(slot.id)}
                  onRemove={() => clearSlot(slot.id)}
                  onDragOver={onSlotDragOver}
                  onDrop={onSlotDrop(slot.id)}
                  onDragStart={onSlotDragStart(slot.id)}
                />
              );
            })}
          </AnimatePresence>

          {/* Help hint */}
          {assignedCount === 0 && (
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-[3px] border border-[#F3EFE6]/25 bg-[#0a0a14]/75 px-3 py-1.5 font-[var(--f-mono)] text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/80">
              Tap a slot · then tap a player · or drag
            </div>
          )}
        </div>

        {/* Bench */}
        <aside
          onDragOver={onBenchDragOver}
          onDrop={onBenchDrop}
          className="flex min-h-[360px] flex-col rounded-[6px] border border-[#F3EFE6]/20 bg-[#0a0a14]/50 p-3"
        >
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaFutbol style={{ color: accent }} />
              <span className="font-[var(--f-mono)] text-[11px] font-bold uppercase tracking-[0.2em] text-[#F3EFE6]">
                Bench
              </span>
            </div>
            <span className="font-[var(--f-mono)] text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/55">
              {benchPlayers.length} available
            </span>
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players…"
            className="mb-3 w-full rounded-[4px] border border-[#F3EFE6]/15 bg-[#0a0a14]/70 px-2.5 py-1.5 font-[var(--f-body)] text-sm text-[#F3EFE6] placeholder:text-[#F3EFE6]/35 focus:border-[var(--accent)] focus:outline-none"
            style={{ ["--accent" as any]: accent }}
          />

          {focusedSlot && (
            <div
              className="mb-2 rounded-[4px] border px-2 py-1.5 font-[var(--f-mono)] text-[10px] uppercase tracking-[0.15em]"
              style={{
                borderColor: accent,
                background: `${accent}15`,
                color: accent,
              }}
            >
              Slot focused · pick a player
            </div>
          )}
          {selectedPlayerId != null && !focusedSlot && (
            <div
              className="mb-2 rounded-[4px] border px-2 py-1.5 font-[var(--f-mono)] text-[10px] uppercase tracking-[0.15em]"
              style={{
                borderColor: accent,
                background: `${accent}15`,
                color: accent,
              }}
            >
              Player selected · pick a slot
            </div>
          )}

          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
            {benchPlayers.length === 0 ? (
              <div className="rounded-[4px] border border-dashed border-[#F3EFE6]/20 p-4 text-center font-[var(--f-mono)] text-[11px] uppercase tracking-[0.15em] text-[#F3EFE6]/50">
                {players.length === 0
                  ? "No players in roster"
                  : assignedCount === players.length
                    ? "All players assigned"
                    : "No matches"}
              </div>
            ) : (
              benchPlayers.map((p) => (
                <BenchCard
                  key={p.id}
                  player={p}
                  selected={selectedPlayerId === p.id}
                  accent={accent}
                  onClick={() => handlePlayerPick(p.id)}
                  onDragStart={onBenchDragStart(p.id)}
                />
              ))
            )}
          </div>
        </aside>
      </div>
    </section>
  );
};

export default FormationBuilder;
