// app/tournoua/match/[id]/MatchStats.tsx
import * as React from "react";
import Image from "next/image";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";

/* ──────────────────────────────────────────────────────────────────────────
   Glass UI tokens
   ────────────────────────────────────────────────────────────────────────── */
const GLASS_CARD =
  "rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.6)] text-white";
const GLASS_ROW =
  "flex flex-wrap items-start justify-between gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 backdrop-blur";
const GLASS_BADGE =
  "rounded-full border border-white/15 bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/80 backdrop-blur-sm";

/** Small pill badge (glass) */
function Badge({ children }: { children: React.ReactNode }) {
  return <span className={GLASS_BADGE}>{children}</span>;
}

/** Stat chip (for team totals only) */
function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-base font-semibold leading-none text-white">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-white/60">{label}</div>
    </div>
  );
}

/** Robust ID equality across number/string/uuid */
function sameTeam(a: unknown, b: unknown) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

/** Safely resolve player image sources for next/image */
function resolveImgSrc(raw?: string | null): string | undefined {
  if (!raw) return undefined;

  // Absolute URL → allowed only if domain matches next.config images.remotePatterns
  if (/^https?:\/\//i.test(raw)) return raw;

  // Root-relative path → fine
  if (raw.startsWith("/")) return raw;

  // Common case: public asset stored as "players/..."
  if (raw.startsWith("players/")) return `/${raw}`;

  // Otherwise treat as a storage key for the proxy: sanitize first
  const key = raw.replace(/^\/+/, "");
  if (key.includes("..")) return undefined; // guard against traversal
  return `/api/player-img/${encodeURI(key)}`;
}

/** Team panel */
function TeamPanel({
  title,
  teamId,
  associations,
  participants,
  statsByPlayer,
  tone = "left",
  teamMetrics,
}: {
  title: string;
  teamId: Id;
  associations: PlayerAssociation[];
  participants: Map<number, ParticipantRow>;
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  tone?: "left" | "right";
  /** Optional team-level metrics */
  teamMetrics?: Partial<{
    possessionPct: number;
    shots: number;
    shotsOnTarget: number;
    fouls: number;
    corners: number;
    offsides: number;
    xg: number;
  }>;
}) {
  // Decide who to render:
  // - If a participant played for this team (byParticipants)
  // - OR if there is a stats row for this team (byStats)
  const played = associations.filter((a) => {
    const part = participants.get(a.player.id) || null;
    const row = statsByPlayer.get(a.player.id) || null;
    const byParticipants = !!(part?.played && sameTeam(part.team_id, teamId));
    const byStats = !!(row && sameTeam(row.team_id, teamId));
    return byParticipants || byStats;
  });

  // team totals from match_player_stats
  let tGoals = 0,
    tAssists = 0,
    tY = 0,
    tR = 0,
    tB = 0;
  for (const a of played) {
    const s = statsByPlayer.get(a.player.id);
    tGoals += s?.goals ?? 0;
    tAssists += s?.assists ?? 0;
    tY += s?.yellow_cards ?? 0;
    tR += s?.red_cards ?? 0;
    tB += s?.blue_cards ?? 0;
  }

  const align = tone === "left" ? "items-start text-left" : "items-end text-right";

  return (
    <div className={`flex flex-1 flex-col gap-4 ${GLASS_CARD}`}>
      {/* Header: Team + Totals + (optional) team metrics */}
      <div className={`flex flex-col gap-3 ${align}`}>
        <div className="text-lg font-semibold text-white">{title}</div>

        <div className="flex flex-wrap gap-4">
          <Chip label="Goals" value={tGoals} />
          <Chip label="Assists" value={tAssists} />
          <Chip label="Yellow" value={tY} />
          <Chip label="Red" value={tR} />
          <Chip label="Blue" value={tB} />
          {typeof teamMetrics?.possessionPct === "number" && (
            <Chip label="Possession" value={`${teamMetrics.possessionPct}%`} />
          )}
          {typeof teamMetrics?.shots === "number" && <Chip label="Shots" value={teamMetrics.shots} />}
          {typeof teamMetrics?.shotsOnTarget === "number" && (
            <Chip label="On Target" value={teamMetrics.shotsOnTarget} />
          )}
          {typeof teamMetrics?.fouls === "number" && <Chip label="Fouls" value={teamMetrics.fouls} />}
          {typeof teamMetrics?.corners === "number" && <Chip label="Corners" value={teamMetrics.corners} />}
          {typeof teamMetrics?.offsides === "number" && <Chip label="Offsides" value={teamMetrics.offsides} />}
          {typeof teamMetrics?.xg === "number" && <Chip label="xG" value={teamMetrics.xg} />}
        </div>
      </div>

      {/* Players list */}
      {played.length === 0 ? (
        <div className="rounded-lg border border-dashed border-white/15 bg-white/5 p-4 text-sm text-white/70 backdrop-blur-sm">
          No participants yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {played.map(({ player }) => {
            const part = participants.get(player.id) || null;
            const row = statsByPlayer.get(player.id) || null;

            // unified source of truth (stats row first, then participants for old data)
            const pos: string | null =
              (row?.position ?? part?.position ?? null) || null; // show nothing if missing
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
                <div className="min-w-0 flex items-start gap-3">
                  <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/20 bg-white/10 backdrop-blur-sm">
                    {imgSrc ? (
                      <Image
                        src={imgSrc}
                        alt={`${name} photo`}
                        width={36}
                        height={36}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-white/80">
                        {initials}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{name}</div>

                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      {pos && <Badge>Pos: {pos}</Badge>}
                      {isCaptain && <Badge>Captain</Badge>}
                      {isGK && <Badge>GK</Badge>}
                      {isMvp && <Badge>🏅 MVP</Badge>}
                      {isBestGk && <Badge>🧤 Best GK</Badge>}
                    </div>

                    {/* Detailed per-player stats list (full words, not abbreviations) */}
                    <ul className="mt-2 list-disc list-inside text-xs text-white/80 space-y-0.5">
                      <li>Goals: {goals}</li>
                      <li>Assists: {assists}</li>
                      <li>Yellow cards: {yellow}</li>
                      <li>Red cards: {red}</li>
                      <li>Blue cards: {blue}</li>
                    </ul>
                  </div>
                </div>
                {/* no right-side abbreviated chips anymore */}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function MatchStats({
  teamA,
  teamB,
  associationsA,
  associationsB,
  statsByPlayer,
  participants,
  teamAMetrics,
  teamBMetrics,
}: {
  teamA: { id: Id; name: string };
  teamB: { id: Id; name: string };
  associationsA: PlayerAssociation[];
  associationsB: PlayerAssociation[];
  statsByPlayer: Map<number, MatchPlayerStatRow>;
  participants: Map<number, ParticipantRow>;
  /** optional injected team-level metrics (wire up later if you track them) */
  teamAMetrics?: TeamPanelProps["teamMetrics"];
  teamBMetrics?: TeamPanelProps["teamMetrics"];
}) {
  return (
    <section className={GLASS_CARD}>
      <h2 className="mb-4 text-lg font-semibold text-white">Match Participants & Stats</h2>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <TeamPanel
          title={teamA.name}
          teamId={teamA.id}
          associations={associationsA}
          participants={participants}
          statsByPlayer={statsByPlayer}
          tone="left"
          teamMetrics={teamAMetrics}
        />
        <TeamPanel
          title={teamB.name}
          teamId={teamB.id}
          associations={associationsB}
          participants={participants}
          statsByPlayer={statsByPlayer}
          tone="right"
          teamMetrics={teamBMetrics}
        />
      </div>
    </section>
  );
}

type TeamPanelProps = React.ComponentProps<typeof TeamPanel>;
