"use client";

/**
 * EditorialPlayerCard — sandbox redesign of the top-players cards.
 * Editorial broadsheet language: mono-caps masthead, Fraunces italic surname,
 * Archivo Black hero numeral, hard borders + offset accent shadow.
 *
 * Designed for the 700×390 CardSwap stage (TopPlayers section).
 */

import Image from "next/image";
import { forwardRef, type HTMLAttributes } from "react";
import { Card } from "@/components/CardSwap";
import type { TopPlayerData } from "@/components/cards/types";
import MarqueeText from "./MarqueeText";

export type EditorialCategory = "scorer" | "assister" | "mvp" | "gk";

const rankPalette = [
  // #1 — League Leader (gold)
  {
    accent: "#E8B931",
    label: "League Leader",
    short: "№ 01",
  },
  // #2 — Silver
  {
    accent: "#CED3DD",
    label: "2η Θέση",
    short: "№ 02",
  },
  // #3 — Bronze/orange (primary accent)
  {
    accent: "#fb923c",
    label: "3η Θέση",
    short: "№ 03",
  },
  // Fallback
  {
    accent: "#9ca3af",
    label: "Contender",
    short: "№ 04",
  },
];

const categoryMeta: Record<
  EditorialCategory,
  { title: string; heroLabel: string; pullStat: (p: TopPlayerData) => number; perGameFor?: "goals" | "assists" }
> = {
  scorer: {
    title: "Σκόρερ",
    heroLabel: "Γκολ",
    pullStat: (p) => p.goals ?? 0,
    perGameFor: "goals",
  },
  assister: {
    title: "Πάσες",
    heroLabel: "Ασίστ",
    pullStat: (p) => p.assists ?? 0,
    perGameFor: "assists",
  },
  mvp: {
    title: "MVP",
    heroLabel: "MVP",
    pullStat: (p) => p.mvpAwards ?? 0,
  },
  gk: {
    title: "Best GK",
    heroLabel: "Best GK",
    pullStat: (p) => p.bestGkAwards ?? 0,
  },
};

interface EditorialPlayerCardProps extends HTMLAttributes<HTMLDivElement> {
  player: TopPlayerData;
  index: number;
  category: EditorialCategory;
}

const EditorialPlayerCard = forwardRef<HTMLDivElement, EditorialPlayerCardProps>(
  ({ player, index, category, style, onClick, ...rest }, ref) => {
    const rank = rankPalette[Math.min(index, rankPalette.length - 1)];
    const meta = categoryMeta[category];
    const heroValue = meta.pullStat(player);
    const perGame =
      meta.perGameFor && player.matches > 0
        ? (
            (meta.perGameFor === "goals" ? player.goals : player.assists) /
            player.matches
          ).toFixed(2)
        : null;

    return (
      <Card
        ref={ref}
        style={style}
        onClick={onClick}
        customClass="rounded-none border border-[#F3EFE6]/20 bg-[#0a0a14] transition-colors duration-500"
        {...rest}
      >
        {/* Soft offset accent shadow (toned down) */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ boxShadow: `6px 6px 0 0 ${rank.accent}` }}
        />

        {/* Ambient accent glow on the right half — the "old gradient" feel */}
        <div
          aria-hidden
          className="absolute top-0 right-0 w-[60%] h-full pointer-events-none"
          style={{
            background: `linear-gradient(to left, ${rank.accent}22 0%, transparent 100%)`,
            opacity: 0.55,
          }}
        />

        {/* Body — full card, left photo column + right content column */}
        <div className="absolute inset-0 flex z-10">
          {/* ── Left: photo column (spans full card height) ── */}
          <div className="relative w-[40%] h-full overflow-hidden bg-[#0d0d18]">
            <Image
              src={player.photo || "/images/default-player.png"}
              alt={`${player.firstName} ${player.lastName}`}
              fill
              className="object-cover object-top"
              sizes="(max-width: 768px) 40vw, 280px"
            />
            {/* Horizontal fade — photo softens into the stats side */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#0c0d10]/40 to-[#0a0a14]" />
            {/* Top fade for contrast on name area */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a14] via-transparent to-transparent opacity-60" />

            {/* Team badge overlay — bottom-left, no outline */}
            {player.teamLogo && (
              <div className="absolute bottom-4 left-4 flex items-center gap-2">
                <div className="relative h-10 w-10 bg-[#13131d]/70 backdrop-blur-sm p-1.5">
                  <Image
                    src={player.teamLogo}
                    alt={player.teamName || ""}
                    fill
                    className="object-contain"
                    sizes="40px"
                  />
                </div>
                {player.teamName && (
                  <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/70 max-w-[120px] truncate">
                    {player.teamName}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Right: content column with its own top strip + masthead ── */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Top accent strip — ONLY over the right column */}
            <div className="h-[4px] w-full" style={{ background: rank.accent }} />

            {/* Masthead row — starts from the right of the photo */}
            <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.3em]">
              <span className="flex items-center gap-3 font-bold" style={{ color: rank.accent }}>
                <span className="h-[2px] w-6" style={{ background: rank.accent }} />
                {rank.short} · {meta.title}
              </span>
              <span className="text-[#F3EFE6]/60">{rank.label}</span>
            </div>

            {/* Stats body */}
            <div className="flex-1 flex flex-col justify-between px-7 py-6">
              {/* Name block */}
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.32em] text-[#F3EFE6]/55 mb-1.5">
                  {player.firstName || "—"}
                </div>
                <h3
                  className="font-[var(--f-display)] italic font-black leading-[0.88] tracking-[-0.02em] text-[#F3EFE6] uppercase block"
                  style={{
                    fontSize: "clamp(2.2rem, 6.2vw, 3.6rem)",
                    whiteSpace: "nowrap",
                  }}
                >
                  <MarqueeText>{player.lastName}</MarqueeText>
                </h3>

                {/* Accent bar + category label */}
                <div className="mt-3 flex items-center gap-3">
                  <span className="h-[3px] w-10" style={{ background: rank.accent }} />
                  <span
                    className="font-mono text-[15px] sm:text-[17px] uppercase tracking-[0.3em] font-bold"
                    style={{ color: rank.accent }}
                  >
                    {meta.heroLabel}
                  </span>
                </div>
              </div>

              {/* Hero stat — number smaller, label much bigger */}
              <div className="relative flex items-baseline gap-5 -ml-1">
                <span
                  className="font-[var(--f-brutal)] leading-[0.82] tracking-tight"
                  style={{
                    color: rank.accent,
                    fontSize: "clamp(3.25rem, 9vw, 6rem)",
                    textShadow: `3px 3px 0 rgba(0,0,0,0.55)`,
                  }}
                >
                  {heroValue}
                </span>
                <span
                  className="font-[var(--f-display)] italic font-black uppercase leading-none text-[#F3EFE6]/85"
                  style={{ fontSize: "clamp(1.75rem, 4.5vw, 3rem)" }}
                >
                  {meta.heroLabel}
                </span>
              </div>

              {/* Secondary stats — hairline grid */}
              <div className="grid grid-cols-3 border-t-2 border-[#F3EFE6]/15 pt-4 -mx-1">
                <StatCell value={String(player.goals ?? 0)} label="Γκολ" />
                <StatCell value={String(player.assists ?? 0)} label="Ασίστ" divider />
                <StatCell
                  value={perGame ?? String(player.matches ?? 0)}
                  label={perGame ? "Ανά αγώνα" : "Αγώνες"}
                  divider
                  highlight={!!perGame}
                  accent={rank.accent}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>
    );
  }
);

EditorialPlayerCard.displayName = "EditorialPlayerCard";

// ───────────────────────────────────────────────────────────────────────
// StatCell — small shared cell used in the secondary-stats grid
// ───────────────────────────────────────────────────────────────────────
function StatCell({
  value,
  label,
  divider,
  highlight,
  accent,
}: {
  value: string;
  label: string;
  divider?: boolean;
  highlight?: boolean;
  accent?: string;
}) {
  return (
    <div className={`relative px-2 ${divider ? "border-l border-[#F3EFE6]/12" : ""}`}>
      <div
        className="font-[var(--f-brutal)] text-2xl leading-none tabular-nums"
        style={{ color: highlight && accent ? accent : "#F3EFE6" }}
      >
        {value}
      </div>
      <div className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/50">
        {label}
      </div>
    </div>
  );
}

export default EditorialPlayerCard;

// ───────────────────────────────────────────────────────────────────────
// Category-bound wrappers (CardSwap renderCard expects refs)
// ───────────────────────────────────────────────────────────────────────
type CategoryCardProps = Omit<EditorialPlayerCardProps, "category">;

export const EditorialScorerCard = forwardRef<HTMLDivElement, CategoryCardProps>((props, ref) => (
  <EditorialPlayerCard ref={ref} category="scorer" {...props} />
));
EditorialScorerCard.displayName = "EditorialScorerCard";

export const EditorialAssisterCard = forwardRef<HTMLDivElement, CategoryCardProps>((props, ref) => (
  <EditorialPlayerCard ref={ref} category="assister" {...props} />
));
EditorialAssisterCard.displayName = "EditorialAssisterCard";

export const EditorialMvpCard = forwardRef<HTMLDivElement, CategoryCardProps>((props, ref) => (
  <EditorialPlayerCard ref={ref} category="mvp" {...props} />
));
EditorialMvpCard.displayName = "EditorialMvpCard";

export const EditorialBestGkCard = forwardRef<HTMLDivElement, CategoryCardProps>((props, ref) => (
  <EditorialPlayerCard ref={ref} category="gk" {...props} />
));
EditorialBestGkCard.displayName = "EditorialBestGkCard";
