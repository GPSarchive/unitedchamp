// app/tournoua/match/[id]/MatchStats.tsx
import * as React from "react";
import type { Id, PlayerAssociation } from "@/app/lib/types";
import type { MatchPlayerStatRow, ParticipantRow } from "./queries";

/** Small pill badge */
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-700">
      {children}
    </span>
  );
}

/** Stat chip */
function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-base font-semibold leading-none">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wide text-zinc-500">{label}</div>
    </div>
  );
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
  // filter to players who played for this team
  const played = associations.filter(
    (a) =>
      participants.has(a.player.id) &&
      participants.get(a.player.id)!.played &&
      participants.get(a.player.id)!.team_id === teamId
  );

  // team totals
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

  // layout helpers
  const align = tone === "left" ? "items-start text-left" : "items-end text-right";

  return (
    <div className="flex flex-1 flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm">
      {/* Header: Team + Totals + (optional) team metrics */}
      <div className={`flex flex-col gap-3 ${align}`}>
        <div className="text-lg font-semibold">{title}</div>

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
        <div className="rounded-lg border border-dashed bg-zinc-50 p-4 text-sm text-zinc-600">
          No participants yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {played.map(({ player }) => {
            const part = participants.get(player.id)!;
            const row = statsByPlayer.get(player.id);

            const pos = part.position ?? "TBD";

            const isMvp = !!row?.mvp;
            const isBestGk = !!row?.best_goalkeeper;

            return (
              <div
                key={player.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 hover:bg-zinc-50"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">
                    {player.first_name} {player.last_name}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <Badge>Pos: {pos}</Badge>
                    {part.is_captain && <Badge>Captain</Badge>}
                    {part.gk && <Badge>GK</Badge>}
                    {isMvp && <Badge>🏅 MVP</Badge>}
                    {isBestGk && <Badge>🧤 Best GK</Badge>}
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-3 text-center">
                  <Chip label="G" value={row?.goals ?? 0} />
                  <Chip label="A" value={row?.assists ?? 0} />
                  <Chip label="Y" value={row?.yellow_cards ?? 0} />
                  <Chip label="R" value={row?.red_cards ?? 0} />
                  <Chip label="B" value={row?.blue_cards ?? 0} />
                </div>
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
    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold">Match Participants & Stats</h2>

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