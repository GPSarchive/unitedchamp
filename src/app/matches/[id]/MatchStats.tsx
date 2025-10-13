// src/app/matches/[id]/MatchStats.tsx
import * as React from "react";
import Image from "next/image";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";
import GlossOverlay from "@/app/paiktes/GlossOverlay"; // 👈 uses your provided gloss effect

/* ──────────────────────────────────────────────────────────
   Glass UI tokens
   ────────────────────────────────────────────────────────── */
const GLASS_CARD =
  "rounded-2xl border border-black/40 bg-white/5 backdrop-blur-md p-8 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] text-white";
const GLASS_ROW =
  "flex flex-col gap-4 rounded-xl border border-black/40 bg-white/10 p-6 hover:bg-white/15 backdrop-blur transition-all";
const GLASS_BADGE =
  "rounded-full border border-white/20 bg-white/15 px-3 py-1 text-sm font-semibold text-white/90 backdrop-blur-sm";

const cx = (...c: Array<string | false | undefined | null>) =>
  c.filter(Boolean).join(" ");

/** Small pill badge (glass) */
function Badge({ children }: { children: React.ReactNode }) {
  return <span className={GLASS_BADGE}>{children}</span>;
}

/** Labeled stat row with icon */
function StatLine({
  icon,
  label,
  value,
  color = "text-white/90",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between text-lg font-medium">
      <div className="flex items-center gap-2">
        <span className={`text-2xl ${color}`}>{icon}</span>
        <span className="text-white/80">{label}</span>
      </div>
      <span className="text-white font-semibold">{value}</span>
    </div>
  );
}

/** Robust ID equality across number/string/uuid */
function sameTeam(a: unknown, b: unknown) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** Resolve image sources */
function resolveImgSrc(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).trim();
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("/")) return s;
  const key = s.replace(/^\/+/, "");
  if (!key || key.includes("..")) return undefined;
  return `/api/storage/player-img?path=${encodeURIComponent(key)}`;
}

/** Team panel (list view, stacked layout) */
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
    <div className="flex flex-col gap-6">
      {played.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/40 bg-white/5 p-4 text-base text-white/75 backdrop-blur-sm">
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
          const imgSrc = resolveImgSrc((player as any).photo as string | null | undefined);
          const initials = `${player.first_name?.[0] ?? ""}${player.last_name?.[0] ?? ""}`.toUpperCase();

          const goals = row?.goals ?? 0;
          const assists = row?.assists ?? 0;
          const yellow = row?.yellow_cards ?? 0;
          const red = row?.red_cards ?? 0;
          const blue = row?.blue_cards ?? 0;

          return (
            <div key={player.id} className={GLASS_ROW}>
              <div className="flex items-center gap-6">
                {/* Portrait with black bg + gloss animation */}
                <div className="relative h-28 w-20 overflow-hidden rounded-lg border border-black/50 bg-black shrink-0">
                  {imgSrc ? (
                    <>
                      <Image
                        src={imgSrc}
                        alt={`${name} photo`}
                        fill
                        sizes="80px"
                        className="object-cover"
                        unoptimized
                      />
                      {/* Gloss overlay (uses your provided animation) */}
                      <GlossOverlay
                        src={imgSrc}
                        maskSrc={imgSrc}
                        run
                        disableIfOpaque={false} // show effect even for JPEGs (no alpha)
                        intensity={1}
                        angle={18}
                        thickness={120}
                        duration={3.2}
                      />
                    </>
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xl font-bold text-white/85">
                      {initials}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="text-xl font-bold tracking-wide text-white drop-shadow-sm">
                    {name}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {pos && <Badge>Pos: {pos}</Badge>}
                    {isCaptain && <Badge>Captain</Badge>}
                    {isGK && <Badge>GK</Badge>}
                    {isMvp && <Badge>🏅 MVP</Badge>}
                    {isBestGk && <Badge>🧤 Best GK</Badge>}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-3 border-t border-black/30 pt-4">
                <StatLine icon="⚽️" label="Goals" value={goals} />
                <StatLine icon="🅰️" label="Assists" value={assists} color="text-sky-400" />
                <StatLine icon="🟨" label="Κίτρινη Κάρτα" value={yellow} color="text-yellow-400" />
                <StatLine icon="🟥" label="Κόκκινη Κάρτα" value={red} color="text-red-400" />
                <StatLine icon="🟦" label="Μπλέ καρτα" value={blue} color="text-blue-400" />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

type TeamPanelProps = React.ComponentProps<typeof TeamPanel>;

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
        <h2 className="mb-6 text-2xl font-semibold text-white">
          Match Participants &amp; Stats
        </h2>
      )}

      <div className="relative">
        {/* center divider → black tint */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-black/30 md:block" />

        <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
          <div>
            {labels?.left && (
              <div className="mb-3 text-sm uppercase tracking-wider text-white/70">
                {labels.left}
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
              <div className="mb-3 text-right text-sm uppercase tracking-wider text-white/70">
                {labels.right}
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
