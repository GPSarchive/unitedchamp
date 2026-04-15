"use client";

import { motion } from "framer-motion";
import { Trophy, Award, Medal, Crown } from "lucide-react";
import Link from "next/link";
import { TeamImage } from "@/app/lib/OptimizedImage";
import type { StandingRow } from "./queries";

export default function TournamentStandings({
  standings,
  stageKind,
  stageName,
}: {
  standings: StandingRow[];
  stageKind?: "league" | "groups" | "knockout" | null;
  stageName?: string | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, type: "spring", stiffness: 100 }}
      className="relative isolate overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-6 md:p-8 shadow-2xl backdrop-blur-md"
    >
      {/* Subtle warm ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-32 h-64 w-64 rounded-full blur-3xl opacity-15"
        style={{ background: "radial-gradient(closest-side, rgba(251,191,36,0.3), transparent)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 -bottom-32 h-72 w-72 rounded-full blur-3xl opacity-10"
        style={{ background: "radial-gradient(closest-side, rgba(180,40,40,0.25), transparent)" }}
      />

      {/* Header */}
      <div className="relative z-10 mb-8 flex items-center gap-3">
        <motion.div
          initial={{ rotate: -15, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
          className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-700/20 border border-amber-400/30 shadow-[0_0_24px_rgba(251,191,36,0.2)]"
        >
          <Trophy className="h-6 w-6 text-amber-400" />
        </motion.div>
        <div>
          <h2
            className="text-2xl md:text-3xl font-bold text-white"
            style={{
              textShadow:
                "2px 2px 4px rgba(0,0,0,0.8), -1px -1px 0 #000, 1px -1px 0 #000",
            }}
          >
            Βαθμολογία
          </h2>
          {stageName && (
            <p className="text-sm text-white/50 mt-0.5">{stageName}</p>
          )}
        </div>
      </div>

      {standings.length === 0 ? (
        <div className="relative z-10 flex flex-col items-center justify-center py-12 text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white/5 border border-white/10"
          >
            <Trophy className="h-10 w-10 text-white/40" />
          </motion.div>
          <p className="text-lg text-white/70 mb-2">Δεν υπάρχουν διαθέσιμα στοιχεία βαθμολογίας</p>
          <p className="text-sm text-white/50">
            Η βαθμολογία θα εμφανιστεί όταν υπάρξουν αποτελέσματα αγώνων
          </p>
        </div>
      ) : (
        <StandingsContent standings={standings} stageKind={stageKind} />
      )}
    </motion.div>
  );
}

/**
 * Groups standings by group_id and renders each group separately.
 * When a stage has multiple groups, each group's teams are ranked independently,
 * so we must render them in separate sections to avoid duplicate 1st/2nd/3rd icons.
 */
const STAGE_KIND_LABEL: Record<string, string> = {
  league: "Βαθμολογία Πρωταθλήματος",
  groups: "Βαθμολογία Ομίλων",
  knockout: "Νοκ Άουτ",
};

function StandingsContent({
  standings,
  stageKind,
}: {
  standings: StandingRow[];
  stageKind?: "league" | "groups" | "knockout" | null;
}) {
  // Collect distinct groups in insertion order (already sorted by group_id from the query)
  const groupOrder: Array<number | null> = [];
  const groupMap = new Map<number | null, StandingRow[]>();
  for (const s of standings) {
    if (!groupMap.has(s.group_id)) {
      groupOrder.push(s.group_id);
      groupMap.set(s.group_id, []);
    }
    groupMap.get(s.group_id)!.push(s);
  }

  const hasMultipleGroups = groupOrder.length > 1;

  // For a league stage (single null group), show the stage kind label as a header
  const showLeagueHeader = !hasMultipleGroups && stageKind === "league";

  return (
    <div className="relative z-10 space-y-8">
      {showLeagueHeader && (
        <div className="mb-3 flex items-center gap-2">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
            {STAGE_KIND_LABEL.league}
          </span>
          <div className="h-px flex-1 bg-white/10" />
        </div>
      )}
      {groupOrder.map((groupId) => {
        const groupStandings = groupMap.get(groupId)!;
        const groupLabel = groupStandings[0]?.group_name ?? null;

        // Determine this section's header label
        let sectionLabel: string;
        if (groupId === null) {
          sectionLabel = STAGE_KIND_LABEL[stageKind ?? ""] ?? "Βαθμολογία";
        } else {
          sectionLabel = groupLabel ?? `Όμιλος ${String.fromCharCode(0x391 + groupOrder.filter(id => id !== null).indexOf(groupId))}`;
        }

        return (
          <div key={groupId ?? "no-group"}>
            {hasMultipleGroups && (
              <div className="mb-3 flex items-center gap-2">
                <div className="h-px flex-1 bg-white/10" />
                <span className="text-xs font-semibold uppercase tracking-widest text-amber-400/70">
                  {sectionLabel}
                </span>
                <div className="h-px flex-1 bg-white/10" />
              </div>
            )}

            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-left text-sm text-white/40">
                    <th className="pb-3 pl-4 font-medium">#</th>
                    <th className="pb-3 pl-2 font-medium">Ομάδα</th>
                    <th className="pb-3 px-3 text-center font-medium">Αγ</th>
                    <th className="pb-3 px-3 text-center font-medium">Ν</th>
                    <th className="pb-3 px-3 text-center font-medium">Ι</th>
                    <th className="pb-3 px-3 text-center font-medium">Η</th>
                    <th className="pb-3 px-3 text-center font-medium">ΓΥ</th>
                    <th className="pb-3 px-3 text-center font-medium">ΓΚ</th>
                    <th className="pb-3 px-3 text-center font-medium">ΔΓ</th>
                    <th className="pb-3 pr-4 text-right font-medium">Βαθ</th>
                  </tr>
                </thead>
                <tbody>
                  {groupStandings.map((standing, index) => (
                    <StandingRowDesktop
                      key={standing.team_id}
                      standing={standing}
                      index={index}
                      position={standing.rank ?? index + 1}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="space-y-3 md:hidden">
              {groupStandings.map((standing, index) => (
                <StandingCardMobile
                  key={standing.team_id}
                  standing={standing}
                  index={index}
                  position={standing.rank ?? index + 1}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Desktop table row with neon highlights for top positions
 */
function StandingRowDesktop({
  standing,
  index,
  position,
}: {
  standing: StandingRow;
  index: number;
  position: number;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  // Position badge styling
  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_16px_rgba(203,213,225,0.5)]";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-[0_0_16px_rgba(217,119,6,0.5)]";
      default:
        return "bg-white/5 text-white/40 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.tr
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, type: "spring", stiffness: 120 }}
      className={`group transition-all ${
        isTopThree
          ? "bg-gradient-to-r from-amber-500/5 via-amber-400/5 to-amber-500/5"
          : "hover:bg-white/5"
      }`}
    >
      <td className="py-4 pl-4 rounded-l-xl">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition-transform group-hover:scale-110 ${getBadgeStyle()}`}
        >
          {PositionIcon ? (
            <PositionIcon className="h-5 w-5" />
          ) : (
            position
          )}
        </div>
      </td>
      <td className="py-4 pl-2">
        <Link href={`/OMADA/${standing.team_id}`} className="block">
          <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
            <div className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/20 bg-black/50 ring-1 ring-white/10">
              {standing.team.logo ? (
                <TeamImage
                  src={standing.team.logo}
                  alt={standing.team.name}
                  fill
                  objectFit="contain"
                  sizes="40px"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-xs font-bold text-amber-400">
                  {standing.team.name.charAt(0)}
                </div>
              )}
              {/* Shimmer effect for first place */}
              {isFirst && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                />
              )}
            </div>
            <span className={`font-semibold ${isFirst ? "text-amber-200" : "text-white"}`}>
              {standing.team.name}
            </span>
          </div>
        </Link>
      </td>
      <td className="px-3 py-4 text-center text-white/70 font-medium">{standing.played}</td>
      <td className="px-3 py-4 text-center text-amber-400 font-semibold">{standing.won}</td>
      <td className="px-3 py-4 text-center text-white/60 font-semibold">{standing.drawn}</td>
      <td className="px-3 py-4 text-center text-red-400 font-semibold">{standing.lost}</td>
      <td className="px-3 py-4 text-center text-white/70 font-medium">{standing.gf}</td>
      <td className="px-3 py-4 text-center text-white/70 font-medium">{standing.ga}</td>
      <td
        className={`px-3 py-4 text-center font-bold ${
          standing.gd > 0
            ? "text-amber-400"
            : standing.gd < 0
            ? "text-red-400"
            : "text-white/40"
        }`}
      >
        {standing.gd > 0 ? "+" : ""}
        {standing.gd}
      </td>
      <td className="pr-4 py-4 text-right rounded-r-xl">
        <div
          className={`inline-flex items-center justify-center rounded-lg px-3 py-1.5 text-lg font-bold ${
            isFirst
              ? "bg-gradient-to-r from-amber-400/20 to-yellow-500/20 text-amber-200 ring-1 ring-amber-400/40"
              : "text-white"
          }`}
        >
          {standing.points}
        </div>
      </td>
    </motion.tr>
  );
}

/**
 * Mobile card with compact stats and neon accents
 */
function StandingCardMobile({
  standing,
  index,
  position,
}: {
  standing: StandingRow;
  index: number;
  position: number;
}) {
  const isTopThree = position <= 3;
  const isFirst = position === 1;

  const getBadgeStyle = () => {
    switch (position) {
      case 1:
        return "bg-gradient-to-br from-amber-400 to-yellow-500 text-amber-950 shadow-[0_0_20px_rgba(251,191,36,0.6)]";
      case 2:
        return "bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_16px_rgba(203,213,225,0.5)]";
      case 3:
        return "bg-gradient-to-br from-amber-600 to-amber-700 text-amber-100 shadow-[0_0_16px_rgba(217,119,6,0.5)]";
      default:
        return "bg-white/5 text-white/40 border border-white/10";
    }
  };

  const PositionIcon = position === 1 ? Crown : position === 2 ? Medal : position === 3 ? Award : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.4, type: "spring" }}
      className={`rounded-2xl border p-4 backdrop-blur-sm transition-all ${
        isTopThree
          ? "border-amber-400/20 bg-gradient-to-br from-amber-500/10 via-amber-400/5 to-amber-600/10 shadow-[0_0_24px_rgba(251,191,36,0.1)]"
          : "border-white/10 bg-white/5 hover:bg-white/10"
      }`}
    >
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/omada/${standing.team_id}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold ${getBadgeStyle()}`}
          >
            {PositionIcon ? (
              <PositionIcon className="h-5 w-5" />
            ) : (
              position
            )}
          </div>
          <div className="relative h-12 w-12 overflow-hidden rounded-xl border border-white/20 bg-black/50">
            {standing.team.logo ? (
              <TeamImage
                src={standing.team.logo}
                alt={standing.team.name}
                fill
                objectFit="contain"
                sizes="48px"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-bold text-amber-400">
                {standing.team.name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className={`truncate font-semibold ${isFirst ? "text-amber-200" : "text-white"}`}>
              {standing.team.name}
            </div>
            <div className="text-xs text-white/40">{standing.played} αγώνες</div>
          </div>
        </Link>
        <div
          className={`text-2xl font-bold ${
            isFirst
              ? "bg-gradient-to-br from-amber-200 to-yellow-300 bg-clip-text text-transparent"
              : "text-white"
          }`}
        >
          {standing.points}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3 text-center">
        <div className="rounded-lg bg-white/5 border border-white/10 py-2">
          <div className="text-xs text-white/40">Ν</div>
          <div className="font-bold text-amber-400">{standing.won}</div>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 py-2">
          <div className="text-xs text-white/40">Ι</div>
          <div className="font-bold text-white/70">{standing.drawn}</div>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 py-2">
          <div className="text-xs text-white/40">Η</div>
          <div className="font-bold text-red-400">{standing.lost}</div>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/10 py-2">
          <div className="text-xs text-white/40">ΔΓ</div>
          <div
            className={`font-bold ${
              standing.gd > 0
                ? "text-amber-400"
                : standing.gd < 0
                ? "text-red-400"
                : "text-white/40"
            }`}
          >
            {standing.gd > 0 ? "+" : ""}
            {standing.gd}
          </div>
        </div>
      </div>
    </motion.div>
  );
}