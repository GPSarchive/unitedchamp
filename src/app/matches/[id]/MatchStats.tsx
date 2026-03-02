// src/app/matches/[id]/MatchStats.tsx
import * as React from "react";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import GlossOverlay from "@/app/paiktes/GlossOverlay";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { FaFutbol, FaCrown, FaStar, FaHandPaper } from "react-icons/fa";
import { GiGoalKeeper } from "react-icons/gi";

/* ─────────────────────────────────────────────────────
   Glass UI tokens
   ───────────────────────────────────────────────────── */
const GLASS_CARD =
  "rounded-2xl border border-white/15 bg-black/40 backdrop-blur-md p-6 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)] text-white";

const PLAYER_ROW =
  "flex flex-col rounded-xl border border-white/10 bg-white/5 overflow-hidden transition-all hover:bg-white/[0.08] hover:border-white/20 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]";

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

/* ─────────────────────────────────────────────────────
   Inline card icons (football card = colored rectangle)
   ───────────────────────────────────────────────────── */
function YellowCardIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-[14px] w-[10px]" : "h-[20px] w-[14px]";
  return (
    <span
      className={`block ${h} rounded-[2px] bg-yellow-400 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_5px_rgba(0,0,0,0.5)]`}
    />
  );
}

function RedCardIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-[14px] w-[10px]" : "h-[20px] w-[14px]";
  return (
    <span
      className={`block ${h} rounded-[2px] bg-red-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.5)]`}
    />
  );
}

function BlueCardIcon({ size = "md" }: { size?: "sm" | "md" }) {
  const h = size === "sm" ? "h-[14px] w-[10px]" : "h-[20px] w-[14px]";
  return (
    <span
      className={`block ${h} rounded-[2px] bg-blue-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_5px_rgba(0,0,0,0.5)]`}
    />
  );
}

/* ─────────────────────────────────────────────────────
   Stat chip — icon + count pill
   ───────────────────────────────────────────────────── */
function StatChip({
  icon,
  label,
  value,
  colorClass = "text-white",
}: {
  icon: React.ReactNode;
  label?: string;
  value: number | string;
  colorClass?: string;
}) {
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 backdrop-blur-sm ${colorClass}`}
    >
      <span className="leading-none">{icon}</span>
      {label && (
        <span className="text-[11px] text-white/50 leading-none uppercase tracking-wider">
          {label}
        </span>
      )}
      <span className="text-sm font-bold leading-none">{value}</span>
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Role badge
   ───────────────────────────────────────────────────── */
type BadgeVariant = "gold" | "blue" | "purple" | "default";

function RoleBadge({
  icon,
  label,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  variant?: BadgeVariant;
}) {
  const variantStyles: Record<BadgeVariant, string> = {
    gold: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    blue: "border-blue-400/40 bg-blue-400/10 text-blue-300",
    purple: "border-purple-400/40 bg-purple-400/10 text-purple-300",
    default: "border-white/20 bg-white/8 text-white/80",
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${variantStyles[variant]}`}
    >
      <span className="text-[10px] leading-none">{icon}</span>
      {label}
    </span>
  );
}

/* ─────────────────────────────────────────────────────
   Robust team-id equality
   ───────────────────────────────────────────────────── */
function sameTeam(a: unknown, b: unknown) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/* ─────────────────────────────────────────────────────
   Team panel
   ───────────────────────────────────────────────────── */
function TeamPanel({
  teamId,
  associations,
  participants,
  statsByPlayer,
}: {
  teamId: Id;
  associations: PlayerAssociation[];
  participants: Map<number, ParticipantRow>;
  statsByPlayer: Map<number, MatchPlayerStatRow>;
}) {
  const played = associations.filter((a) => {
    const part = participants.get(a.player.id) ?? null;
    const row = statsByPlayer.get(a.player.id) ?? null;
    const byParticipants = !!(
      part?.played && String(part.team_id) === String(teamId)
    );
    const byStats = !!(row && String(row.team_id) === String(teamId));
    return byParticipants || byStats;
  });

  if (played.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-white/10 bg-white/3 p-4 text-sm text-white/40 text-center">
        No participants recorded.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {played.map(({ player }) => {
        const row = statsByPlayer.get(player.id) ?? null;

        const pos = row?.position ?? null;
        const isCaptain = !!row?.is_captain;
        const isGK = !!row?.gk;
        const isMvp = !!row?.mvp;
        const isBestGk = !!row?.best_goalkeeper;
        const playerNumber = row?.player_number ?? null;

        const name = `${player.first_name} ${player.last_name}`.trim();
        const imgSrc = (player as any).photo as string | null | undefined;
        const initials =
          `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();

        const goals = row?.goals ?? 0;
        const assists = row?.assists ?? 0;
        const ownGoals = row?.own_goals ?? 0;
        const yellow = row?.yellow_cards ?? 0;
        const red = row?.red_cards ?? 0;
        const blue = row?.blue_cards ?? 0;

        const hasStats =
          goals > 0 ||
          assists > 0 ||
          ownGoals > 0 ||
          yellow > 0 ||
          red > 0 ||
          blue > 0;

        const hasRoles = isCaptain || isGK || isMvp || isBestGk;

        return (
          <div key={player.id} className={PLAYER_ROW}>
            {/* ── Player header ── */}
            <div className="flex items-center gap-3 p-3.5">
              {/* Portrait */}
              <div className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg border border-white/15 bg-black">
                {imgSrc ? (
                  <div className="relative h-full w-full">
                    <PlayerImage
                      src={imgSrc}
                      alt={`${name} photo`}
                      fill
                      objectFit="cover"
                      sizes="44px"
                      priority={false}
                      animate={false}
                    />
                    <GlossOverlay
                      src={imgSrc}
                      maskSrc={imgSrc}
                      run
                      disableIfOpaque={false}
                      intensity={0.7}
                      angle={18}
                      thickness={90}
                      duration={3.2}
                    />
                  </div>
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs font-bold text-white/60">
                    {initials}
                  </div>
                )}
              </div>

              {/* Name + position + badges */}
              <div className="flex-1 min-w-0">
                {/* Number + Name row */}
                <div className="flex items-baseline gap-2 flex-wrap">
                  {playerNumber != null && (
                    <span className="shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-mono font-bold text-white/50">
                      #{playerNumber}
                    </span>
                  )}
                  <span className="font-bold text-white text-sm leading-tight">
                    {name}
                  </span>
                </div>

                {/* Position */}
                {pos && (
                  <div className="mt-0.5 text-[11px] uppercase tracking-widest text-white/40 font-medium">
                    {pos}
                  </div>
                )}

                {/* Role badges */}
                {hasRoles && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {isCaptain && (
                      <RoleBadge
                        icon={<FaCrown />}
                        label="Captain"
                        variant="gold"
                      />
                    )}
                    {isGK && (
                      <RoleBadge
                        icon={<GiGoalKeeper />}
                        label="GK"
                        variant="blue"
                      />
                    )}
                    {isMvp && (
                      <RoleBadge
                        icon={<FaStar />}
                        label="MVP"
                        variant="gold"
                      />
                    )}
                    {isBestGk && (
                      <RoleBadge
                        icon={<FaHandPaper />}
                        label="Best GK"
                        variant="purple"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ── Stats strip ── */}
            {hasStats && (
              <div className="flex flex-wrap items-center gap-2 border-t border-white/8 bg-white/[0.02] px-3.5 py-2.5">
                {goals > 0 && (
                  <StatChip
                    icon={<FaFutbol className="text-white text-[13px]" />}
                    value={goals}
                    colorClass="text-white"
                  />
                )}
                {assists > 0 && (
                  <StatChip
                    icon={
                      <svg
                        className="text-sky-400"
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    }
                    label="Ast"
                    value={assists}
                    colorClass="text-sky-400"
                  />
                )}
                {ownGoals > 0 && (
                  <StatChip
                    icon={<FaFutbol className="text-orange-400 text-[13px]" />}
                    label="OG"
                    value={ownGoals}
                    colorClass="text-orange-400"
                  />
                )}

                {/* Card icons — stacked per occurrence */}
                {yellow > 0 && (
                  <div className="inline-flex items-center gap-1">
                    {Array.from({ length: Math.min(yellow, 2) }).map((_, i) => (
                      <YellowCardIcon key={i} />
                    ))}
                    {yellow > 2 && (
                      <span className="text-xs text-yellow-400 font-bold">
                        ×{yellow}
                      </span>
                    )}
                  </div>
                )}
                {red > 0 && <RedCardIcon />}
                {blue > 0 && <BlueCardIcon />}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────
   Public export
   ───────────────────────────────────────────────────── */
export default function ParticipantsStats({
  teamA,
  teamB,
  associationsA,
  associationsB,
  statsByPlayer,
  participants,
  renderAs = "card",
  labels,
  className,
}: {
  teamA: { id: Id; name: string };
  teamB: { id: Id; name: string };
  associationsA: PlayerAssociation[];
  associationsB: PlayerAssociation[];
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  participants: Map<number, ParticipantRow>;
  renderAs?: "card" | "embedded";
  labels?: { left?: string; right?: string };
  className?: string;
}) {
  const outer = renderAs === "card" ? GLASS_CARD : "";

  return (
    <section className={cx(outer, className)}>
      {renderAs === "card" && (
        <div className="mb-5 flex items-center gap-2.5">
          <FaFutbol className="text-white/70 text-lg" />
          <h2 className="text-xl font-semibold text-white">
            Participants &amp; Stats
          </h2>
        </div>
      )}

      <div className="relative">
        {/* Centre divider */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-white/8 md:block" />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {/* Team A */}
          <div>
            {labels?.left && (
              <div className="mb-3 text-xs uppercase tracking-widest text-white/40 font-semibold">
                {labels.left}
              </div>
            )}
            <TeamPanel
              teamId={teamA.id}
              associations={associationsA}
              participants={participants}
              statsByPlayer={statsByPlayer}
            />
          </div>

          {/* Team B */}
          <div>
            {labels?.right && (
              <div className="mb-3 text-xs uppercase tracking-widest text-white/40 font-semibold">
                {labels.right}
              </div>
            )}
            <TeamPanel
              teamId={teamB.id}
              associations={associationsB}
              participants={participants}
              statsByPlayer={statsByPlayer}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
