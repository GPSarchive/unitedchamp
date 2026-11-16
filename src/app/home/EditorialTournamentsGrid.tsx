"use client";

/**
 * Tournament grid styled to match /tournaments page cards.
 * Used only in the /preview/home-c route.
 */

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Tournament } from "@/app/tournaments/useTournamentData";
import { SURFACE, layers, STRIP_TOP, STRIP_BOTTOM, CHIP } from "@/app/lib/ui/flat";

const pad2 = (n: number | string) => String(n).padStart(2, "0");

function statusLabel(status: Tournament["status"]): string {
  if (status === "running") return "Ζωντανά";
  if (status === "completed") return "Έληξε";
  if (status === "archived") return "Αρχείο";
  return "Προγραμματισμένο";
}

const CountBlock: React.FC<{ value: string; label: string }> = ({ value, label }) => (
  <div>
    <div className="font-[var(--f-brutal)] text-2xl leading-none text-[#F3EFE6]">{value}</div>
    <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/50">
      {label}
    </div>
  </div>
);

const TournamentCard: React.FC<{ t: Tournament; index: number }> = ({ t, index }) => {
  const isRunning = t.status === "running";
  const isCompleted = t.status === "completed";
  const isArchived = t.status === "archived";

  const accent = isRunning ? "#fb923c" : isCompleted ? "#E8B931" : "#60a5fa";
  const rotation = index % 2 === 0 ? "0.4deg" : "-0.4deg";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.4) }}
      className="h-full"
    >
      <Link
        href={`/tournaments/${t.id}`}
        aria-label={`Άνοιγμα ${t.name}`}
        className="group block h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[#fb923c] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a14]"
      >
        <div
          className={`relative flex h-full flex-col overflow-hidden ${SURFACE} transition-all duration-300 group-hover:-translate-y-1`}
          style={{
            transform: `rotate(${rotation})`,
            boxShadow: layers(accent),
          }}
        >
          {/* hover spotlight */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(400px 200px at 100% 0%, ${accent}22 0%, transparent 60%)`,
            }}
          />

          {/* header strip */}
          <div className={`flex items-center justify-between ${STRIP_TOP} px-4 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]`}>
            <span className="flex items-center gap-1.5 font-bold" style={{ color: accent }}>
              {isRunning && (
                <span
                  className="h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: accent }}
                />
              )}
              {statusLabel(t.status)}
            </span>
            <span className="text-[#F3EFE6]/60">N°{pad2(t.id)}</span>
          </div>

          {/* body */}
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start gap-4">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logo}
                  alt={`${t.name} logo`}
                  className="h-14 w-14 shrink-0 rounded-full border-2 object-cover"
                  style={{ borderColor: accent }}
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = "/team-placeholder.svg";
                  }}
                />
              ) : (
                <div
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full border-2 bg-[#13131d]"
                  style={{ borderColor: accent }}
                >
                  <span
                    className="font-[var(--f-brutal)] text-xl"
                    style={{ color: accent }}
                  >
                    {String(t.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="font-[var(--f-display)] text-xl md:text-2xl font-black italic leading-tight text-[#F3EFE6] line-clamp-2">
                  {t.name}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em]">
                  {t.season && (
                    <span className={`${CHIP} px-1.5 py-0.5 text-[#F3EFE6]/75`}>
                      Σεζόν {t.season}
                    </span>
                  )}
                  {t.format && (
                    <span className={`${CHIP} px-1.5 py-0.5 text-[#F3EFE6]/75`}>
                      {t.format}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* champion row */}
            {isCompleted && (t as any).winner_team_name && (
              <div
                className="mt-4 flex items-center gap-2 rounded-md px-3 py-2"
                style={{
                  backgroundColor: "color-mix(in srgb, #E8B931 16%, transparent)",
                }}
              >
                <span className="font-[var(--f-brutal)] text-sm text-[#E8B931]">★</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#E8B931]">
                  Πρωταθλητής
                </span>
                <span className="flex-1 truncate font-[var(--f-display)] text-sm italic font-semibold text-[#F3EFE6]">
                  {(t as any).winner_team_name}
                </span>
              </div>
            )}

            {/* counts + CTA */}
            <div className="mt-auto flex items-end justify-between pt-5">
              <div className="grid grid-cols-2 gap-3">
                <CountBlock value={String(t.teams_count ?? "—")} label="Ομάδες" />
                <CountBlock value={String(t.matches_count ?? "—")} label="Αγώνες" />
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60 group-hover:text-[#fb923c] transition-colors">
                Προβολή →
              </span>
            </div>
          </div>

          {/* bottom strip — tournament id */}
          <div
            className={`flex items-center justify-between ${STRIP_BOTTOM} px-4 py-1.5 font-mono text-[9px] uppercase tracking-[0.28em]`}
            style={{
              color: "rgba(243,239,230,0.4)",
            }}
          >
            <span>UC · {pad2(t.id)}</span>
            {isArchived && <span>ΑΡΧΕΙΟ</span>}
            {!isArchived && t.status && (
              <span
                className="inline-block h-[6px] w-[6px] rounded-full"
                style={{ background: accent, opacity: 0.8 }}
              />
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

type Props = { tournaments: Tournament[] };

export default function EditorialTournamentsGrid({ tournaments }: Props) {
  if (!tournaments || tournaments.length === 0) {
    return (
      <div
        className={`relative ${SURFACE} p-10 text-center`}
        style={{ boxShadow: layers("#fb923c") }}
      >
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          / 00 · Κατάλογος
        </span>
        <p className="mt-4 font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6]">
          Δεν υπάρχουν διοργανώσεις
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tournaments.map((t, i) => (
        <TournamentCard key={t.id} t={t} index={i} />
      ))}
    </div>
  );
}
