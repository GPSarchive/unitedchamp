//matches/[id]/TeamBadge.tsx
import Image from "next/image";
import type { Id } from "@/app/lib/types";

export default function TeamBadge({
  team,
  className = "",
  highlight = false,
}: {
  team: { id: Id; name: string; logo: string | null };
  className?: string;
  highlight?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative h-12 w-12 overflow-hidden rounded-xl ring-1 ring-gray-200">
        {team.logo ? (
          <Image src={team.logo} alt={`${team.name} logo`} fill className="object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center bg-gray-100 text-xs text-gray-400">
            No Logo
          </div>
        )}
      </div>
      <div>
        <div className={`text-base font-semibold ${highlight ? "text-emerald-600" : ""}`}>
          {team.name}
        </div>
        <div className="text-xs text-gray-500">Team #{team.id}</div>
      </div>
    </div>
  );
}
