// src/app/matches/[id]/MatchStats.tsx
import * as React from "react";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import GlossOverlay from "@/app/paiktes/GlossOverlay";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { 
  Target, 
  HandHelping, 
  AlertCircle, 
  Shield, 
  Crown,
  Trophy,
  Award
} from "lucide-react";

/* ──────────────────────────────────────────────────────────
   Yellow/Orange/Black contrast hierarchy
   ────────────────────────────────────────────────────────── */
const GLASS_CARD =
  "rounded-2xl border border-amber-800/40 bg-black/90 backdrop-blur-md p-4 md:p-8 shadow-[0_8px_40px_rgba(0,0,0,0.8)] text-white";

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

/** Small pill badge (gold accent) */
function Badge({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-600/20 px-2.5 py-1 text-xs font-semibold text-amber-100 backdrop-blur-sm">
      {icon}
      {children}
    </span>
  );
}

/** Stat display with icon */
function StatBadge({
  icon: Icon,
  value,
  label,
  color = "text-amber-400",
}: {
  icon: any;
  value: number;
  label: string;
  color?: string;
}) {
  if (value === 0) return null;
  
  return (
    <div className="flex items-center gap-1.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full bg-neutral-800/80 ${color}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex flex-col">
        <span className="text-xs font-bold text-white">{value}</span>
        <span className="text-[10px] uppercase tracking-wide text-amber-200/70">{label}</span>
      </div>
    </div>
  );
}

/** Card color schemes based on card type */
function getCardColor(type: 'yellow' | 'red' | 'blue') {
  switch(type) {
    case 'yellow': return 'bg-yellow-500/25 border-yellow-500/50';
    case 'red': return 'bg-red-500/25 border-red-500/50';
    case 'blue': return 'bg-blue-500/25 border-blue-500/50';
  }
}

function CardDisplay({ type, count }: { type: 'yellow' | 'red' | 'blue'; count: number }) {
  if (count === 0) return null;
  
  const colorClass = getCardColor(type);
  const label = type === 'yellow' ? 'Κίτρινη' : type === 'red' ? 'Κόκκινη' : 'Μπλέ';
  
  return (
    <div className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${colorClass}`}>
      <div className="flex h-6 w-4 items-center justify-center rounded-sm bg-current opacity-90">
        <span className="text-[10px] font-bold text-black">{count}</span>
      </div>
      <span className="text-xs font-medium text-white">{label}</span>
    </div>
  );
}

/** Team panel */
function TeamPanel({
  teamId,
  associations,
  participants,
  statsByPlayer,
  tone = "left",
}: {
  teamId: Id;
  associations: PlayerAssociation[];
  participants: Map<number, ParticipantRow>;
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  tone?: "left" | "right";
}) {
  const played = associations.filter((a) => {
    const part = participants.get(a.player.id) || null;
    const row = statsByPlayer.get(a.player.id) || null;
    const byParticipants = !!(part?.played && String(part.team_id) === String(teamId));
    const byStats = !!(row && String(row.team_id) === String(teamId));
    return byParticipants || byStats;
  });

  return (
    <div className="flex flex-col gap-4">
      {played.length === 0 ? (
        <div className="rounded-lg border border-dashed border-amber-700/50 bg-neutral-900/60 p-6 text-center text-sm text-amber-200/70 backdrop-blur-sm">
          No participants yet.
        </div>
      ) : (
        played.map(({ player }) => {
          const part = participants.get(player.id) || null;
          const row = statsByPlayer.get(player.id) || null;

          const pos = row?.position ?? part?.position ?? null;
          const isCaptain = !!(row?.is_captain ?? part?.is_captain);
          const isGK = !!(row?.gk ?? part?.gk);
          const isMvp = !!row?.mvp;
          const isBestGk = !!row?.best_goalkeeper;

          const name = `${player.first_name} ${player.last_name}`.trim();
          const imgSrc = (player as any).photo as string | null | undefined;
          const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();

          const goals = row?.goals ?? 0;
          const assists = row?.assists ?? 0;
          const ownGoals = row?.own_goals ?? 0;
          const yellow = row?.yellow_cards ?? 0;
          const red = row?.red_cards ?? 0;
          const blue = row?.blue_cards ?? 0;

          const hasStats = goals > 0 || assists > 0 || ownGoals > 0;
          const hasCards = yellow > 0 || red > 0 || blue > 0;

          return (
            <div 
              key={player.id} 
              className="group overflow-hidden rounded-xl border border-amber-800/40 bg-gradient-to-br from-neutral-900/80 to-neutral-950/80 backdrop-blur transition-all hover:border-amber-600/50 hover:shadow-lg"
            >
              {/* Player Header */}
              <div className="flex items-start gap-4 p-4">
                {/* Portrait */}
                <div className="relative h-24 w-20 shrink-0 overflow-hidden rounded-lg border border-amber-700/50 bg-black shadow-lg sm:h-28 sm:w-24">
                  {imgSrc ? (
                    <div className="relative h-full w-full">
                      <PlayerImage
                        src={imgSrc}
                        alt={`${name} photo`}
                        fill
                        objectFit="cover"
                        sizes="(min-width: 640px) 96px, 80px"
                        priority={false}
                        animate={false}
                      />
                      <GlossOverlay
                        src={imgSrc}
                        maskSrc={imgSrc}
                        run
                        disableIfOpaque={false}
                        intensity={1}
                        angle={18}
                        thickness={120}
                        duration={3.2}
                      />
                    </div>
                  ) : (
                    <div className="grid h-full w-full place-items-center text-2xl font-bold text-amber-300">
                      {initials}
                    </div>
                  )}

                  {/* MVP/Best GK Corner Badge */}
                  {(isMvp || isBestGk) && (
                    <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-black bg-amber-400 shadow-lg">
                      {isMvp ? (
                        <Trophy className="h-4 w-4 text-black" />
                      ) : (
                        <Shield className="h-4 w-4 text-black" />
                      )}
                    </div>
                  )}
                </div>

                {/* Player Info */}
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div>
                    <h3 className="truncate text-base font-bold leading-tight text-white sm:text-lg">
                      {name}
                    </h3>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {pos && <Badge>{pos}</Badge>}
                      {isCaptain && <Badge icon={<Crown className="h-3 w-3" />}>Captain</Badge>}
                      {isGK && <Badge icon={<Shield className="h-3 w-3" />}>GK</Badge>}
                    </div>
                  </div>

                  {/* Special Awards */}
                  {(isMvp || isBestGk) && (
                    <div className="flex flex-wrap gap-1.5">
                      {isMvp && (
                        <div className="flex items-center gap-1 rounded-md bg-amber-500/25 px-2 py-1 text-xs font-semibold text-amber-100">
                          <Trophy className="h-3 w-3" />
                          MVP
                        </div>
                      )}
                      {isBestGk && (
                        <div className="flex items-center gap-1 rounded-md bg-amber-500/25 px-2 py-1 text-xs font-semibold text-amber-100">
                          <Shield className="h-3 w-3" />
                          Best GK
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Section */}
              {(hasStats || hasCards) && (
                <div className="space-y-3 border-t border-amber-800/30 bg-neutral-950/50 p-4">
                  {/* Performance Stats */}
                  {hasStats && (
                    <div className="flex flex-wrap gap-3">
                      <StatBadge icon={Target} value={goals} label="Goals" color="text-amber-400" />
                      <StatBadge icon={HandHelping} value={assists} label="Assists" color="text-amber-300" />
                      {ownGoals > 0 && (
                        <StatBadge icon={AlertCircle} value={ownGoals} label="Own Goals" color="text-orange-400" />
                      )}
                    </div>
                  )}

                  {/* Cards */}
                  {hasCards && (
                    <div className="flex flex-wrap gap-2">
                      <CardDisplay type="yellow" count={yellow} />
                      <CardDisplay type="red" count={red} />
                      <CardDisplay type="blue" count={blue} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

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
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            Match Participants &amp; Stats
          </h2>
          <div className="mt-2 h-1 w-20 rounded-full bg-gradient-to-r from-amber-500 to-transparent" />
        </div>
      )}

      <div className="relative">
        {/* Desktop divider only */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-amber-600/50 to-transparent lg:block" />

        {/* STACKED layout - removed grid for mobile, only grid on large screens */}
        <div className="space-y-8 lg:grid lg:grid-cols-2 lg:gap-10 lg:space-y-0">
          <div>
            {labels?.left && (
              <div className="mb-4 flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-200">
                  {labels.left}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-r from-amber-600/50 to-transparent" />
              </div>
            )}
            <TeamPanel
              teamId={teamA.id}
              associations={associationsA}
              participants={participants}
              statsByPlayer={statsByPlayer}
              tone="left"
            />
          </div>

          <div>
            {labels?.right && (
              <div className="mb-4 flex items-center gap-2 lg:flex-row-reverse">
                <h3 className="text-sm font-bold uppercase tracking-wider text-amber-200">
                  {labels.right}
                </h3>
                <div className="h-px flex-1 bg-gradient-to-l from-amber-600/50 to-transparent lg:bg-gradient-to-r" />
              </div>
            )}
            <TeamPanel
              teamId={teamB.id}
              associations={associationsB}
              participants={participants}
              statsByPlayer={statsByPlayer}
              tone="right"
            />
          </div>
        </div>
      </div>
    </section>
  );
}