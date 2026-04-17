"use client";

import Link from "next/link";
import type { Team } from "@/app/lib/types";

const pad2 = (n: number | string) => String(n).padStart(2, "0");

const validColour = (c: string | null | undefined): string | null =>
  c && /^#[0-9A-Fa-f]{6}$/.test(c) ? c : null;

export default function TeamCard({
  team,
  index,
}: {
  team: Team;
  index: number;
}) {
  const accent = validColour(team.colour) ?? "#fb923c";
  const rotation = index % 2 === 0 ? "0.25deg" : "-0.25deg";
  const initial = String(team.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/OMADA/${team.id}`}
      aria-label={`Άνοιγμα ${team.name ?? "ομάδας"}`}
      className="group block focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]"
    >
      <div
        className="relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#F3EFE6]/40"
        style={{
          transform: `rotate(${rotation})`,
          boxShadow: `5px 5px 0 0 ${accent}`,
        }}
      >
        {/* header strip */}
        <div className="flex items-center justify-between border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
          <span
            className="flex items-center gap-1.5 font-bold"
            style={{ color: accent }}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: accent }}
            />
            Ομάδα
          </span>
          <span>N°{pad2(team.id)}</span>
        </div>

        {/* Logo disc — square body */}
        <div
          className="relative aspect-square flex items-center justify-center"
          style={{
            backgroundImage: `radial-gradient(circle at 50% 40%, ${accent}22 0%, transparent 60%)`,
          }}
        >
          <div
            className="relative flex h-[68%] w-[68%] items-center justify-center rounded-full border-2"
            style={{
              borderColor: accent,
              background: "#13131d",
              boxShadow: `0 0 30px ${accent}22`,
            }}
          >
            {team.logo ? (
              <img
                src={team.logo}
                alt={`${team.name} logo`}
                className="h-[85%] w-[85%] rounded-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src =
                    "/team-placeholder.svg";
                }}
              />
            ) : (
              <span
                className="font-[var(--f-brutal)] text-4xl md:text-5xl"
                style={{ color: accent }}
              >
                {initial}
              </span>
            )}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(260px 120px at 50% 0%, ${accent}26 0%, transparent 65%)`,
            }}
          />
        </div>

        {/* Name + arrow */}
        <div className="flex items-center justify-between gap-2 border-t-2 border-[#F3EFE6]/15 px-3 py-2.5">
          <h3 className="min-w-0 flex-1 truncate font-[var(--f-display)] text-sm font-semibold italic leading-tight text-[#F3EFE6]">
            {team.name ?? "—"}
          </h3>
          <span className="font-mono text-[11px] text-[#F3EFE6]/40 transition-colors group-hover:text-[#fb923c]">
            →
          </span>
        </div>

        {/* Bottom meta */}
        <div className="flex items-center justify-between border-t border-[#F3EFE6]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.28em] text-[#F3EFE6]/40">
          <span>UC · {pad2(team.id)}</span>
          {team.am && (
            <span className="text-[#F3EFE6]/55">AM · {team.am}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
