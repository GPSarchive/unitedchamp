"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import type {
  Awards,
  DraftMatch,
  Group,
  Player,
  Stage,
  Standing,
  Team,
  Tournament,
} from "./useTournamentData"; // Import types from useTournamentData
import { useTournamentData } from "./useTournamentData";
import { useStages } from "./useStages"; // Assuming .tsx now
// import TournamentHeader from "./TournamentHeader"; // Optional

// Define props type using imported types from useTournamentData
type TournamentClientProps = {
  initialData: {
    tournament: Tournament;
    teams: Team[];
    players: Player[];
    matches: DraftMatch[];
    stages: Stage[];
    standings: Standing[];
    awards: Awards | null;
    groups: Group[];
  };
};

const Skeleton: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="h-10 w-2/3 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/40 backdrop-blur p-6"
          >
            <div className="h-6 w-1/2 rounded-lg bg-slate-200 dark:bg-slate-800 animate-pulse" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-full rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-4 w-5/6 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
              <div className="h-4 w-2/3 rounded bg-slate-200 dark:bg-slate-800 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);

const TournamentClient: React.FC<TournamentClientProps> = ({ initialData }) => {
  const {
    tournament,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setAwards,
    setGroups,
  } = useTournamentData();
  const { stages: sortedStages, getRendererForStage } = useStages(); // Centralized!

  useEffect(() => {
    if (!tournament) {
      setTournamentData(initialData.tournament);
      setTeams(initialData.teams);
      setPlayers(initialData.players);
      setMatches(initialData.matches);
      setStages(initialData.stages); // Auto-computes IDs
      setStandings(initialData.standings);
      // setAwards(initialData.awards ?? null);
      setGroups(initialData.groups); // Auto-computes group IDs
    }
    // Including `tournament` prevents re-seeding once it's populated
  }, [
    initialData,
    tournament,
    setTournamentData,
    setTeams,
    setPlayers,
    setMatches,
    setStages,
    setStandings,
    setAwards,
    setGroups,
  ]);

  if (!tournament) return <Skeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* <TournamentHeader /> */}
        <header className="flex flex-col gap-3">
          <motion.h1
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100"
          >
            {tournament?.name ?? "Tournament"}
          </motion.h1>
          {(tournament as any)?.location || (tournament as any)?.startDate ? (
            <p className="text-slate-600 dark:text-slate-400">
              <span>{(tournament as any)?.location}</span>
              {(tournament as any)?.startDate && (tournament as any)?.endDate ? (
                <>
                  {" · "}
                  <time dateTime={String((tournament as any).startDate)}>
                    {String((tournament as any).startDate)}
                  </time>
                  {" – "}
                  <time dateTime={String((tournament as any).endDate)}>
                    {String((tournament as any).endDate)}
                  </time>
                </>
              ) : null}
            </p>
          ) : null}
        </header>

        <div className="stages mt-8">
          <h2 className="sr-only">Tournament Stages</h2>

          {sortedStages.length > 0 ? (
            <ul className="grid gap-6 md:grid-cols-2">
              {sortedStages.map((stage) => {
                const Renderer = getRendererForStage(stage); // Centralized delegation
                return (
                  <li key={stage.id}>
                    <motion.section
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                      aria-labelledby={`stage-${stage.id}`}
                      className="group rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur shadow-sm hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-center justify-between p-5 border-b border-slate-200/80 dark:border-slate-800/80">
                        <h3
                          id={`stage-${stage.id}`}
                          className="text-lg font-semibold text-slate-900 dark:text-slate-100"
                        >
                          {"name" in stage && (stage as any).name
                            ? (stage as any).name
                            : `Stage ${stage.id}`}
                        </h3>
                        {"status" in stage && (stage as any).status ? (
                          <span className="inline-flex h-7 items-center rounded-full border border-slate-200 dark:border-slate-700 px-3 text-xs font-medium text-slate-600 dark:text-slate-300">
                            {(stage as any).status}
                          </span>
                        ) : null}
                      </div>

                      <div className="p-5">
                        <Renderer stage={stage} />
                      </div>
                    </motion.section>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
              <p className="text-slate-600 dark:text-slate-400">
                No stages available for this tournament.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentClient;
