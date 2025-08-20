import Image from "next/image";
import { Team } from "@/app/lib/types";

export default function TeamHeader({ team }: { team: Team }) {
  return (
    <div className="text-center mb-8">
      {team.logo && (
        <Image
          src={team.logo}
          alt={`${team.name} logo`}
          width={128}
          height={128}
          className="mx-auto mb-4"
        />
      )}
      <h1 className="text-4xl font-extrabold text-white/90 tracking-tight">
        {team.name}
      </h1>
      <p className="text-gray-400 mt-2">
        Established: {team.created_at ? new Date(team.created_at).toLocaleDateString() : "Unknown"}
      </p>
    </div>
  );
}
