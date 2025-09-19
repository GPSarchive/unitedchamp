// matches/[id]/TeamBadge.tsx
import Image from "next/image";
import type { Id } from "@/app/lib/types";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export default function TeamBadge({
  team,
  className = "",
  highlight = false,
}: {
  team: { id: Id; name: string; logo: string | null };
  className?: string;
  highlight?: boolean;
}) {
  const ringClass = highlight
    ? "ring-2 ring-orange-500/60 shadow-orange-500/20"
    : "ring-1 ring-orange-400/20";

  const nameClass = highlight ? "text-orange-600" : "text-gray-900";

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div
        className={`relative h-12 w-12 overflow-hidden rounded-2xl bg-white ${ringClass} border border-orange-400/10 shadow-sm`}
        title={team.name}
      >
        {team.logo ? (
          <Image
            src={team.logo}
            alt={`${team.name} logo`}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : (
          <div className="grid h-full w-full place-items-center">
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 bg-orange-500/10">
              {initials(team.name) || "—"}
            </span>
          </div>
        )}
      </div>

      <div className="leading-tight">
        <div className={`text-base font-semibold truncate ${nameClass}`}>
          {team.name}
        </div>
        <div className="text-xs text-gray-500">Team #{team.id}</div>
      </div>
    </div>
  );
}
