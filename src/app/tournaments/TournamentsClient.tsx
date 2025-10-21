// app/tournaments/TournamentsClient.tsx
"use client";

import Link from "next/link";
import type { Tournament } from "@/app/tournaments/useTournamentData";

type TournamentsClientProps = {
  initialTournaments: Tournament[];
};

const TournamentsClient: React.FC<TournamentsClientProps> = ({ initialTournaments }) => {
  return (
    <div className="tournaments-page container mx-auto py-8 px-4">
      <h1 className="text-4xl font-bold text-center mb-8 text-white">Tournaments</h1>
      {initialTournaments.length === 0 ? (
        <p className="text-center text-gray-400">No tournaments available</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {initialTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.id}`}
              className="block"
            >
              <div className="tournament-card bg-black text-white p-6 rounded-lg shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out hover:bg-orange-600">
                <div className="flex items-center gap-4 mb-4">
                  {tournament.logo && (
                    <img
                      src={tournament.logo}
                      alt={`${tournament.name} logo`}
                      className="h-12 w-12 object-cover rounded-full border-2 border-orange-500"
                    />
                  )}
                  <div>
                    <h2 className="text-2xl font-semibold">{tournament.name}</h2>
                    <p className="text-sm text-orange-400">Season: {tournament.season || "N/A"}</p>
                    <p className="text-sm text-gray-400">Format: {tournament.format}</p>
                    <p className="text-sm text-gray-400">Status: {tournament.status}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default TournamentsClient;