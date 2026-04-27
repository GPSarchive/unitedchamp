// PREVIEW v20 — editorial sports-broadsheet restyle of /matches/[id].
// All interactive / animated pieces live here; data loading stays in page.tsx.

"use client";

import Link from "next/link";
import { useMemo } from "react";
import { TournamentImage, TeamImage, PlayerImage } from "@/app/lib/OptimizedImage";
import type { StandingRow } from "@/app/matches/[id]/queries";
import type { MatchPlayerStatRow, MatchStatus } from "@/app/lib/types";

// ── types ───────────────────────────────────────────────────────────────
type TeamLite = { id: number; name: string; logo: string | null };

type ScorerRow = {
  player: { id: number; first_name: string | null; last_name: string | null; photo?: string | null };
  goals: number;
  ownGoals: number;
  teamId: number;
};

type ParticipantRow = {
  player: { id: number; first_name: string | null; last_name: string | null; photo: string | null };
  teamId: number;
  played: boolean;
  stats: MatchPlayerStatRow | null;
  playerNumber: number | null;
};

type RosterEntry = {
  player: {
    id: number;
    first_name: string | null;
    last_name: string | null;
    photo: string | null;
    deleted_at: string | null;
  };
  teamId: number;
};

export type MatchClientProps = {
  match: {
    id: number;
    status: MatchStatus;
    match_date: string | null;
    team_a_score: number | null;
    team_b_score: number | null;
    referee: string | null;
    team_a: TeamLite;
    team_b: TeamLite;
    tournament: { id: number; name: string; logo: string | null } | null;
  };
  scorers: ScorerRow[];
  participantsData: ParticipantRow[];
  rosterData: RosterEntry[];
  standings: StandingRow[];
  stageKind: "league" | "groups" | "knockout" | null;
  stageName: string | null;
  videoId: string | null;
  showWelcomeMessage: boolean;
  dataLoadErrors: string[];
  isAdmin: boolean;
};

// ── date helpers (Greek editorial labels) ───────────────────────────────
const GR_DAY = ["ΚΥΡ", "ΔΕΥ", "ΤΡΙ", "ΤΕΤ", "ΠΕΜ", "ΠΑΡ", "ΣΑΒ"];
const GR_MONTH = [
  "ΙΑΝ", "ΦΕΒ", "ΜΑΡ", "ΑΠΡ", "ΜΑΪ", "ΙΟΥΝ",
  "ΙΟΥΛ", "ΑΥΓ", "ΣΕΠ", "ΟΚΤ", "ΝΟΕ", "ΔΕΚ",
];

function fmtDateParts(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return {
    day: GR_DAY[d.getDay()],
    dom: String(d.getDate()).padStart(2, "0"),
    month: GR_MONTH[d.getMonth()],
    year: String(d.getFullYear()),
    time: d.toLocaleTimeString("el-GR", { hour: "2-digit", minute: "2-digit" }),
  };
}

function playerName(p: { first_name: string | null; last_name: string | null }) {
  const fn = (p.first_name ?? "").trim();
  const ln = (p.last_name ?? "").trim();
  return [fn, ln].filter(Boolean).join(" ") || "—";
}

function statusMeta(status: MatchStatus) {
  if (status === "finished") return { label: "Τελικό", tone: "#F3EFE6" as const };
  if (status === "postponed") return { label: "Αναβλήθηκε", tone: "#E8B931" as const };
  return { label: "Προγραμματισμένος", tone: "#60a5fa" as const };
}

// ── tiny building blocks ────────────────────────────────────────────────
function Kicker({ children, color = "#fb923c" }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.3em]"
      style={{ color }}
    >
      <span className="h-[2px] w-8" style={{ background: color }} />
      {children}
    </div>
  );
}

function SectionHeading({
  kicker,
  title,
  accent = "#fb923c",
}: {
  kicker: string;
  title: string;
  accent?: string;
}) {
  return (
    <div className="mb-6 border-b-2 border-[#F3EFE6]/20 pb-3">
      <Kicker color={accent}>{kicker}</Kicker>
      <h2
        className="mt-3 font-[var(--f-display)] font-black italic leading-none tracking-[-0.02em] text-[#F3EFE6]"
        style={{ fontSize: "clamp(1.5rem, 3.5vw, 2.5rem)" }}
      >
        {title}
      </h2>
    </div>
  );
}

function Panel({
  accent = "#fb923c",
  children,
  className = "",
}: {
  accent?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`border-2 border-[#F3EFE6]/15 bg-[#0a0a14] ${className}`}
      style={{ boxShadow: `6px 6px 0 0 ${accent}` }}
    >
      {children}
    </div>
  );
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "live" | "warn" | "info";
}) {
  const styles: Record<string, string> = {
    neutral: "border-[#F3EFE6]/20 bg-[#13131d] text-[#F3EFE6]/75",
    live: "border-[#fb923c] bg-[#fb923c]/10 text-[#fb923c]",
    warn: "border-[#E8B931]/50 bg-[#E8B931]/10 text-[#E8B931]",
    info: "border-[#60a5fa]/40 bg-[#60a5fa]/10 text-[#60a5fa]",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] ${styles[tone]}`}
    >
      {children}
    </span>
  );
}

// ── tournament masthead ─────────────────────────────────────────────────
function TournamentMasthead({ tournament }: { tournament: { name: string; logo: string | null } }) {
  return (
    <div className="mb-10 flex flex-col items-center text-center md:mb-14">
      <Kicker>Διοργάνωση</Kicker>
      <div className="mt-4 flex items-center gap-4">
        {tournament.logo && (
          <div className="h-14 w-14 overflow-hidden border-2 border-[#F3EFE6]/25 bg-[#13131d] md:h-16 md:w-16">
            <TournamentImage
              src={tournament.logo}
              alt={tournament.name}
              width={64}
              height={64}
              className="h-full w-full object-contain"
              animate={false}
            />
          </div>
        )}
        <h1
          className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.02em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(1.4rem, 3.8vw, 2.6rem)" }}
        >
          {tournament.name}
        </h1>
      </div>
    </div>
  );
}

// ── welcome message (empty scheduled match) ─────────────────────────────
function WelcomeBlock({ matchDate }: { matchDate: string | null }) {
  const dt = fmtDateParts(matchDate);
  return (
    <Panel accent="#60a5fa" className="p-6 md:p-8">
      <Kicker color="#60a5fa">Επερχόμενος Αγώνας</Kicker>
      <p
        className="mt-4 font-[var(--f-display)] font-black italic leading-tight text-[#F3EFE6]"
        style={{ fontSize: "clamp(1.3rem, 3vw, 2rem)" }}
      >
        Οι λεπτομέρειες του αγώνα θα εμφανιστούν εδώ.
      </p>
      <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
        Ακόμη δεν έχει οριστεί αποτέλεσμα ή συμμετοχές. Επιστρέψτε κοντά στην
        ώρα της έναρξης.
      </p>
      {dt && (
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Chip tone="info">{dt.day} {dt.dom} {dt.month}</Chip>
          <Chip tone="info">Ώρα {dt.time}</Chip>
        </div>
      )}
    </Panel>
  );
}

// ── error banner ────────────────────────────────────────────────────────
function ErrorBanner({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <Panel accent="#E8B931" className="p-5">
      <Kicker color="#E8B931">Σφάλμα Φόρτωσης</Kicker>
      <ul className="mt-3 space-y-1 font-mono text-[11px] uppercase tracking-[0.15em] text-[#E8B931]">
        {errors.map((m, i) => (
          <li key={i}>· {m}</li>
        ))}
      </ul>
    </Panel>
  );
}

// ── scoreboard hero ─────────────────────────────────────────────────────
function ScoreboardHero({
  match,
  scorers,
}: {
  match: MatchClientProps["match"];
  scorers: ScorerRow[];
}) {
  const meta = statusMeta(match.status);
  const isFinished = match.status === "finished";
  const dt = fmtDateParts(match.match_date);
  const accent = isFinished ? "#fb923c" : "#60a5fa";

  const scorersA = scorers.filter((s) => s.teamId === match.team_a.id);
  const scorersB = scorers.filter((s) => s.teamId === match.team_b.id);

  return (
    <div className="border-2 border-[#F3EFE6]/25 bg-[#0a0a14]" style={{ boxShadow: `10px 10px 0 0 ${accent}` }}>
      <div className="h-[3px] w-full" style={{ background: accent }} />

      {/* masthead strip */}
      <div className="flex items-center justify-between gap-3 border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-2.5 md:px-5">
        <span
          className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em]"
          style={{ color: accent }}
        >
          <span className="h-[2px] w-6" style={{ background: accent }} />
          {meta.label}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
          N°{String(match.id).padStart(4, "0")}
        </span>
      </div>

      {/* body */}
      <div className="p-5 md:p-10">
        <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-3 md:gap-8">
          {/* team A */}
          <TeamColumn team={match.team_a} scorers={scorersA} align="right" />

          {/* center */}
          <div className="flex flex-col items-center gap-3 md:gap-4">
            {isFinished ? (
              <div className="flex items-center gap-3 md:gap-5">
                <ScoreDigit value={match.team_a_score} />
                <span className="font-[var(--f-brutal)] text-xl text-[#F3EFE6]/40 md:text-3xl">·</span>
                <ScoreDigit value={match.team_b_score} />
              </div>
            ) : (
              <div
                className="flex flex-col items-center border-2 px-4 py-3"
                style={{ borderColor: accent }}
              >
                <span className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: accent }}>
                  {dt?.day ?? "—"}
                </span>
                <span className="font-[var(--f-brutal)] text-3xl text-[#F3EFE6] md:text-4xl">
                  {dt?.dom ?? "—"}
                </span>
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/65">
                  {dt?.month ?? ""}
                </span>
              </div>
            )}
            {dt && (
              <div className="font-[var(--f-brutal)] text-lg text-[#F3EFE6] md:text-2xl">
                {dt.time}
              </div>
            )}
            <Chip tone={isFinished ? "live" : "info"}>
              {isFinished ? "Αποτέλεσμα" : "Έναρξη"}
            </Chip>
          </div>

          {/* team B */}
          <TeamColumn team={match.team_b} scorers={scorersB} align="left" />
        </div>
      </div>

      {/* footer */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-[#F3EFE6]/15 bg-[#0d0d18] px-4 py-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/70 md:px-5">
        {dt && (
          <>
            <span>{dt.day} · {dt.dom} {dt.month} {dt.year}</span>
            <span className="text-[#F3EFE6]/25">·</span>
          </>
        )}
        {match.tournament && (
          <>
            <span>{match.tournament.name}</span>
            <span className="text-[#F3EFE6]/25">·</span>
          </>
        )}
        <span>Διαιτητής: {match.referee ?? "—"}</span>
      </div>
    </div>
  );
}

function ScoreDigit({ value }: { value: number | null }) {
  return (
    <span
      className="font-[var(--f-brutal)] leading-none text-[#F3EFE6]"
      style={{ fontSize: "clamp(3rem, 9vw, 6rem)" }}
    >
      {value ?? "—"}
    </span>
  );
}

function TeamColumn({
  team,
  scorers,
  align,
}: {
  team: TeamLite;
  scorers: ScorerRow[];
  align: "left" | "right";
}) {
  const alignClasses = align === "right" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col gap-3 ${alignClasses}`}>
      <div className={`flex flex-col ${align === "right" ? "items-end" : "items-start"} gap-3`}>
        <div className="h-20 w-20 overflow-hidden border-2 border-[#F3EFE6]/25 bg-[#13131d] md:h-28 md:w-28">
          <TeamImage
            src={team.logo ?? null}
            alt={team.name}
            width={112}
            height={112}
            className="h-full w-full object-contain"
            animate={false}
          />
        </div>
        <h3
          className="font-[var(--f-display)] font-black italic leading-[0.95] tracking-[-0.01em] text-[#F3EFE6]"
          style={{ fontSize: "clamp(1rem, 2.6vw, 1.75rem)" }}
        >
          {team.name}
        </h3>
      </div>

      {scorers.length > 0 && (
        <ul className="mt-1 space-y-1">
          {scorers.map((s) => (
            <li
              key={`${s.player.id}-${s.goals}-${s.ownGoals}`}
              className={`flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[#F3EFE6]/80 ${
                align === "right" ? "justify-end" : "justify-start"
              }`}
            >
              <span className="text-[#fb923c]">⚽</span>
              <span>{playerName(s.player)}</span>
              {s.goals > 1 && <span className="text-[#F3EFE6]/50">×{s.goals}</span>}
              {s.ownGoals > 0 && <span className="text-[#E8B931]">(OG)</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── team strip (header above a player grid) ─────────────────────────────
function TeamStrip({
  team,
  countLabel,
  countValue,
  accent,
}: {
  team: TeamLite;
  countLabel: string;
  countValue: number;
  accent: string;
}) {
  return (
    <div
      className="flex items-center justify-between border-2 border-[#F3EFE6]/20 bg-[#13131d] px-4 py-3"
      style={{ boxShadow: `4px 4px 0 0 ${accent}` }}
    >
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 overflow-hidden border-2 border-[#F3EFE6]/25 bg-[#0a0a14]">
          <TeamImage
            src={team.logo ?? null}
            alt={team.name}
            width={40}
            height={40}
            className="h-full w-full object-contain"
            animate={false}
          />
        </div>
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.3em]" style={{ color: accent }}>
            Ρόστερ
          </div>
          <div className="font-[var(--f-display)] text-lg italic font-black text-[#F3EFE6] leading-none">
            {team.name}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-[var(--f-brutal)] text-2xl text-[#F3EFE6] leading-none">
          {String(countValue).padStart(2, "0")}
        </div>
        <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
          {countLabel}
        </div>
      </div>
    </div>
  );
}

// ── rosters (scheduled) ─────────────────────────────────────────────────
function RostersGrid({
  teamA,
  teamB,
  entries,
}: {
  teamA: TeamLite;
  teamB: TeamLite;
  entries: RosterEntry[];
}) {
  const a = entries.filter((e) => e.teamId === teamA.id);
  const b = entries.filter((e) => e.teamId === teamB.id);
  return (
    <div>
      <SectionHeading kicker="Ρόστερ" title="Σύνθεση Ομάδων" />
      <div className="space-y-10">
        <TeamRosterBlock team={teamA} entries={a} accent="#fb923c" />
        <TeamRosterBlock team={teamB} entries={b} accent="#60a5fa" />
      </div>
    </div>
  );
}

function TeamRosterBlock({
  team,
  entries,
  accent,
}: {
  team: TeamLite;
  entries: RosterEntry[];
  accent: string;
}) {
  return (
    <div className="space-y-5">
      <TeamStrip team={team} countLabel="Παίκτες" countValue={entries.length} accent={accent} />
      {entries.length === 0 ? (
        <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.22em] text-[#F3EFE6]/50">
          Δεν έχει δηλωθεί ρόστερ
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {entries.map((e, i) => (
            <RosterPlayerCard key={e.player.id} entry={e} accent={accent} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function RosterPlayerCard({
  entry,
  accent,
  index,
}: {
  entry: RosterEntry;
  accent: string;
  index: number;
}) {
  const { player } = entry;
  const firstName = (player.first_name ?? "").trim();
  const lastName = (player.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Άγνωστος";
  const rotation = index % 2 === 0 ? "0.3deg" : "-0.3deg";

  return (
    <div
      className="group relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[4px_4px_0_0_var(--s)] transition-transform hover:-translate-y-1 sm:shadow-[6px_6px_0_0_var(--s)] sm:[transform:rotate(var(--r))] sm:hover:[transform:rotate(var(--r))_translateY(-6px)]"
      style={
        {
          ["--s" as any]: accent,
          ["--r" as any]: rotation,
        } as React.CSSProperties
      }
    >
      <div
        className="relative aspect-[3/4] overflow-hidden border-b-2 border-[#F3EFE6]/15 bg-[#13131d]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 20%, ${accent}26 0%, transparent 60%)`,
        }}
      >
        <PlayerImage
          src={player.photo ?? null}
          alt={fullName}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          animate={false}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 40%, rgba(10,10,20,0.9) 100%)" }}
        />

        {/* index pip */}
        <div
          className="absolute top-3 left-3 border-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
          style={{ borderColor: accent, background: "#0a0a14", color: accent }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        {player.deleted_at && (
          <div className="absolute top-3 right-3 border border-[#F3EFE6]/30 bg-[#13131d]/80 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/60">
            Αρχείο
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/60">
            Μητρώο
          </p>
          <p className="mt-1 font-[var(--f-display)] text-xl font-black italic leading-none text-[#F3EFE6]">
            {firstName || fullName}
          </p>
          {lastName && (
            <p className="mt-0.5 font-[var(--f-display)] text-base italic text-[#F3EFE6]/80">
              {lastName}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── played participants timeline (finished) ────────────────────────────
function ParticipantsTimeline({
  teamA,
  teamB,
  participants,
}: {
  teamA: TeamLite;
  teamB: TeamLite;
  participants: ParticipantRow[];
}) {
  const played = participants.filter((p) => p.played);
  const a = played.filter((p) => p.teamId === teamA.id);
  const b = played.filter((p) => p.teamId === teamB.id);

  return (
    <div>
      <SectionHeading kicker="Συμμετοχές" title="Στατιστικά Αγώνα" />
      <div className="space-y-10">
        <TeamParticipantsBlock team={teamA} rows={a} accent="#fb923c" />
        <TeamParticipantsBlock team={teamB} rows={b} accent="#60a5fa" />
      </div>
    </div>
  );
}

function TeamParticipantsBlock({
  team,
  rows,
  accent,
}: {
  team: TeamLite;
  rows: ParticipantRow[];
  accent: string;
}) {
  return (
    <div className="space-y-5">
      <TeamStrip team={team} countLabel="Αγωνίστηκαν" countValue={rows.length} accent={accent} />
      {rows.length === 0 ? (
        <div className="border-2 border-dashed border-[#F3EFE6]/20 bg-[#13131d]/40 p-10 text-center font-mono text-sm uppercase tracking-[0.22em] text-[#F3EFE6]/50">
          Δεν καταχωρήθηκαν συμμετοχές
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((r, i) => (
            <ParticipantPlayerCard key={r.player.id} row={r} accent={accent} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParticipantPlayerCard({
  row,
  accent,
  index,
}: {
  row: ParticipantRow;
  accent: string;
  index: number;
}) {
  const { player, stats, playerNumber } = row;
  const firstName = (player.first_name ?? "").trim();
  const lastName = (player.last_name ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Άγνωστος";

  const goals = stats?.goals ?? 0;
  const assists = stats?.assists ?? 0;
  const ownGoals = stats?.own_goals ?? 0;
  const yellow = stats?.yellow_cards ?? 0;
  const red = stats?.red_cards ?? 0;
  const blue = stats?.blue_cards ?? 0;
  const isCaptain = !!stats?.is_captain;
  const isGk = !!stats?.gk;
  const isMvp = !!stats?.mvp;
  const isBestGk = !!stats?.best_goalkeeper;
  const position = stats?.position ?? null;

  const hasHonour = isMvp || isBestGk;
  const rotation = index % 2 === 0 ? "0.3deg" : "-0.3deg";
  const shadowColor = hasHonour ? "#E8B931" : accent;

  return (
    <div
      className="group relative overflow-hidden border-2 border-[#F3EFE6]/20 bg-[#0a0a14] shadow-[4px_4px_0_0_var(--s)] transition-transform hover:-translate-y-1 sm:shadow-[6px_6px_0_0_var(--s)] sm:[transform:rotate(var(--r))] sm:hover:[transform:rotate(var(--r))_translateY(-6px)]"
      style={
        {
          ["--s" as any]: shadowColor,
          ["--r" as any]: rotation,
        } as React.CSSProperties
      }
    >
      {/* portrait */}
      <div
        className="relative aspect-[3/4] overflow-hidden border-b-2 border-[#F3EFE6]/15 bg-[#13131d]"
        style={{
          backgroundImage: `radial-gradient(circle at 50% 20%, ${accent}26 0%, transparent 60%)`,
        }}
      >
        <PlayerImage
          src={player.photo ?? null}
          alt={fullName}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          className="object-cover object-center transition-transform duration-700 group-hover:scale-105"
          animate={false}
        />
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(180deg, transparent 40%, rgba(10,10,20,0.9) 100%)" }}
        />

        {/* top-left: position or jersey */}
        <div className="absolute top-3 left-3 flex flex-col items-start gap-1">
          {position && (
            <span
              className="border-2 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.22em]"
              style={{ borderColor: accent, background: "#0a0a14", color: accent }}
            >
              {position}
            </span>
          )}
          {playerNumber != null && (
            <span
              className="border-2 px-2 py-0.5 font-[var(--f-brutal)] text-sm leading-none"
              style={{ borderColor: "#F3EFE6", background: "#0a0a14", color: "#F3EFE6" }}
            >
              #{playerNumber}
            </span>
          )}
        </div>

        {/* top-right: honour pips */}
        <div className="absolute top-3 right-3 flex flex-col items-end gap-1">
          {isMvp && <HonourPip color="#E8B931">★ MVP</HonourPip>}
          {isBestGk && <HonourPip color="#E8B931">BEST GK</HonourPip>}
          {isCaptain && <HonourPip color="#fb923c">C</HonourPip>}
          {isGk && !isBestGk && <HonourPip color="#60a5fa">GK</HonourPip>}
        </div>

        {/* name */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#F3EFE6]/60">
            {String(index + 1).padStart(2, "0")} · Μητρώο
          </p>
          <p className="mt-1 font-[var(--f-display)] text-xl font-black italic leading-none text-[#F3EFE6]">
            {firstName || fullName}
          </p>
          {lastName && (
            <p className="mt-0.5 font-[var(--f-display)] text-base italic text-[#F3EFE6]/80">
              {lastName}
            </p>
          )}
        </div>
      </div>

      {/* primary stats row */}
      <div className="grid grid-cols-3 divide-x-2 divide-[#F3EFE6]/10">
        <MatchStatBlock label="Γκολ" value={goals} highlight={goals > 0} accent="#fb923c" />
        <MatchStatBlock label="Ασίστ" value={assists} highlight={assists > 0} accent="#60a5fa" />
        <MatchStatBlock
          label="Αυτογκόλ"
          value={ownGoals}
          highlight={ownGoals > 0}
          accent="#E8B931"
        />
      </div>

      {/* cards row (only when any are present) */}
      {(yellow > 0 || red > 0 || blue > 0) && (
        <div className="flex items-center justify-center gap-3 border-t-2 border-[#F3EFE6]/10 bg-[#13131d] px-3 py-2">
          {yellow > 0 && <CardMark count={yellow} color="#E8B931" label="Κίτρινη" />}
          {red > 0 && <CardMark count={red} color="#ef4444" label="Κόκκινη" />}
          {blue > 0 && <CardMark count={blue} color="#60a5fa" label="Μπλε" />}
        </div>
      )}
    </div>
  );
}

function HonourPip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="border px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.22em]"
      style={{
        borderColor: color,
        background: `${color}2E`,
        color,
      }}
    >
      {children}
    </span>
  );
}

function MatchStatBlock({
  label,
  value,
  highlight,
  accent,
}: {
  label: string;
  value: number;
  highlight: boolean;
  accent: string;
}) {
  return (
    <div className="p-3 text-center">
      <div
        className="font-[var(--f-brutal)] text-xl leading-none"
        style={{ color: highlight ? accent : "#F3EFE6" }}
      >
        {value}
      </div>
      <div className="mt-1 font-mono text-[9px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
        {label}
      </div>
    </div>
  );
}

function CardMark({ count, color, label }: { count: number; color: string; label: string }) {
  return (
    <span
      className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.22em]"
      title={label}
    >
      <span className="inline-block h-3 w-2.5" style={{ background: color }} />
      {count > 1 && (
        <span className="font-[var(--f-brutal)] text-sm leading-none text-[#F3EFE6]">
          {count}
        </span>
      )}
    </span>
  );
}

// ── video ───────────────────────────────────────────────────────────────
function VideoEmbed({ videoId }: { videoId: string }) {
  return (
    <div>
      <SectionHeading kicker="Βίντεο Αγώνα" title="Δες τα Στιγμιότυπα" />
      <div className="border-2 border-[#F3EFE6]/15 bg-black" style={{ boxShadow: "6px 6px 0 0 #fb923c" }}>
        <div className="aspect-video w-full overflow-hidden">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${videoId}`}
            title="YouTube video player"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}

// ── standings ───────────────────────────────────────────────────────────
function StandingsBlock({
  standings,
  stageKind,
  stageName,
  highlightTeams,
}: {
  standings: StandingRow[];
  stageKind: "league" | "groups" | "knockout" | null;
  stageName: string | null;
  highlightTeams: Set<number>;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, StandingRow[]>();
    for (const row of standings) {
      const key = row.group_name ?? row.group_id?.toString() ?? "ALL";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(row);
    }
    for (const rows of map.values()) {
      rows.sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    }
    return Array.from(map.entries());
  }, [standings]);

  if (standings.length === 0) {
    return (
      <div>
        <SectionHeading kicker="Βαθμολογία" title={stageName ?? "Βαθμολογία"} />
        <Panel className="p-6 text-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            Δεν υπάρχει διαθέσιμη βαθμολογία για αυτόν τον αγώνα.
          </p>
        </Panel>
      </div>
    );
  }

  const kicker =
    stageKind === "groups"
      ? "Βαθμολογία Ομίλων"
      : stageKind === "knockout"
        ? "Νοκ Άουτ"
        : "Βαθμολογία";

  return (
    <div>
      <SectionHeading kicker={kicker} title={stageName ?? "Βαθμολογία"} />
      <div className="grid grid-cols-1 gap-6">
        {grouped.map(([groupKey, rows]) => (
          <Panel key={groupKey}>
            {stageKind === "groups" && (
              <div className="border-b-2 border-[#F3EFE6]/15 bg-[#13131d] px-4 py-2.5 font-mono text-[11px] uppercase tracking-[0.3em] text-[#fb923c]">
                Όμιλος {rows[0]?.group_name ?? groupKey}
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr className="border-b border-[#F3EFE6]/10 font-mono text-[9px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Ομάδα</th>
                    <th className="px-2 py-2 text-right">Π</th>
                    <th className="px-2 py-2 text-right">Ν</th>
                    <th className="px-2 py-2 text-right">Ι</th>
                    <th className="px-2 py-2 text-right">Η</th>
                    <th className="px-2 py-2 text-right">Γ+</th>
                    <th className="px-2 py-2 text-right">Γ−</th>
                    <th className="px-2 py-2 text-right">ΔΓ</th>
                    <th className="px-3 py-2 text-right text-[#fb923c]">Β</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const highlight = highlightTeams.has(r.team_id);
                    return (
                      <tr
                        key={`${r.group_id ?? "g"}-${r.team_id}`}
                        className={`border-b border-[#F3EFE6]/5 font-mono text-[12px] tracking-[0.05em] transition-colors ${
                          highlight
                            ? "bg-[#fb923c]/10 text-[#F3EFE6]"
                            : "text-[#F3EFE6]/85 hover:bg-[#F3EFE6]/[0.03]"
                        }`}
                      >
                        <td className="px-3 py-2 font-[var(--f-brutal)] text-sm">
                          {r.rank ?? "—"}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2.5">
                            <div className="h-6 w-6 overflow-hidden border border-[#F3EFE6]/20 bg-[#13131d]">
                              <TeamImage
                                src={r.team.logo}
                                alt={r.team.name}
                                width={24}
                                height={24}
                                className="h-full w-full object-contain"
                                animate={false}
                              />
                            </div>
                            <span className="font-[var(--f-display)] italic text-[#F3EFE6] normal-case tracking-normal">
                              {r.team.name}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right">{r.played}</td>
                        <td className="px-2 py-2 text-right">{r.won}</td>
                        <td className="px-2 py-2 text-right">{r.drawn}</td>
                        <td className="px-2 py-2 text-right">{r.lost}</td>
                        <td className="px-2 py-2 text-right">{r.gf}</td>
                        <td className="px-2 py-2 text-right">{r.ga}</td>
                        <td className="px-2 py-2 text-right">{r.gd}</td>
                        <td className="px-3 py-2 text-right font-[var(--f-brutal)] text-base text-[#fb923c]">
                          {r.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

// ── main component ──────────────────────────────────────────────────────
export default function MatchClient(props: MatchClientProps) {
  const {
    match,
    scorers,
    participantsData,
    rosterData,
    standings,
    stageKind,
    stageName,
    videoId,
    showWelcomeMessage,
    dataLoadErrors,
  } = props;

  const isScheduled = match.status === "scheduled";
  const highlightTeams = useMemo(
    () => new Set<number>([match.team_a.id, match.team_b.id]),
    [match.team_a.id, match.team_b.id]
  );

  return (
    <section className="relative min-h-dvh bg-[#08080f] text-[#F3EFE6]">
      {/* subtle grid overlay */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(#F3EFE6 1px, transparent 1px), linear-gradient(90deg, #F3EFE6 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 -z-0 h-[40rem] w-[60rem] -translate-x-1/2 rounded-full opacity-[0.18] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
        }}
      />

      <div className="relative mx-auto max-w-[1200px] px-4 pb-16 pt-10 md:px-6 md:pb-20 md:pt-14">
        {/* breadcrumb / back */}
        <div className="mb-8 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/60">
          <Link
            href="/matches"
            className="inline-flex items-center gap-2 transition-colors hover:text-[#fb923c]"
          >
            <span>←</span>
            Πίσω στους Αγώνες
          </Link>
          <span>Αγώνας · N°{String(match.id).padStart(4, "0")}</span>
        </div>

        {match.tournament && <TournamentMasthead tournament={match.tournament} />}

        <div className="space-y-10 md:space-y-14">
          <ErrorBanner errors={dataLoadErrors} />

          {showWelcomeMessage && <WelcomeBlock matchDate={match.match_date} />}

          <ScoreboardHero match={match} scorers={scorers} />

          {isScheduled && rosterData.length > 0 ? (
            <RostersGrid teamA={match.team_a} teamB={match.team_b} entries={rosterData} />
          ) : participantsData.length > 0 ? (
            <ParticipantsTimeline
              teamA={match.team_a}
              teamB={match.team_b}
              participants={participantsData}
            />
          ) : null}

          {videoId && <VideoEmbed videoId={videoId} />}

          <StandingsBlock
            standings={standings}
            stageKind={stageKind}
            stageName={stageName}
            highlightTeams={highlightTeams}
          />
        </div>
      </div>
    </section>
  );
}
