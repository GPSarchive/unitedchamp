// TournamentDebug.tsx - Diagnostic component
"use client";

import React from "react";
import { useTournamentData } from "./useTournamentData";

const TournamentDebug: React.FC = () => {
  const tournament = useTournamentData((s) => s.tournament);
  const stages = useTournamentData((s) => s.stages);
  const teams = useTournamentData((s) => s.teams);
  const matches = useTournamentData((s) => s.matches);
  const standings = useTournamentData((s) => s.standings);
  const groups = useTournamentData((s) => s.groups);
  const ids = useTournamentData((s) => s.ids);

  return (
    <div className="bg-gray-900 text-white p-6 rounded-lg space-y-4 max-w-4xl mx-auto my-8">
      <h2 className="text-2xl font-bold border-b border-gray-700 pb-2">
        Tournament Store Debug
      </h2>

      <section>
        <h3 className="text-xl font-semibold mb-2">Tournament</h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(tournament, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Stages ({stages?.length ?? 0})
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(stages, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Computed IDs
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(ids, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Groups ({groups?.length ?? 0})
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(groups, null, 2)}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Teams ({teams?.length ?? 0})
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(teams?.slice(0, 3), null, 2)}
          {(teams?.length ?? 0) > 3 && <div className="text-gray-400 mt-2">... and {(teams?.length ?? 0) - 3} more</div>}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Matches ({matches?.length ?? 0})
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(matches?.slice(0, 3), null, 2)}
          {(matches?.length ?? 0) > 3 && <div className="text-gray-400 mt-2">... and {(matches?.length ?? 0) - 3} more</div>}
        </pre>
      </section>

      <section>
        <h3 className="text-xl font-semibold mb-2">
          Standings ({standings?.length ?? 0})
        </h3>
        <pre className="bg-gray-800 p-3 rounded overflow-x-auto text-xs">
          {JSON.stringify(standings?.slice(0, 5), null, 2)}
          {(standings?.length ?? 0) > 5 && <div className="text-gray-400 mt-2">... and {(standings?.length ?? 0) - 5} more</div>}
        </pre>
      </section>
    </div>
  );
};

export default TournamentDebug;