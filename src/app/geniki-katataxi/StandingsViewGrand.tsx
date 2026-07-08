// app/geniki-katataxi/StandingsViewGrand.tsx
// GRAND design of the Γενική Κατάταξη — an all-time hall-of-champions ledger.
// This is the live route's renderer (/geniki-katataxi).
//
// Design language: "Champions League title sequence meets a hand-set almanac".
//   · Ceremonial gold (#e8c66b) is a metallic tier reserved for the champion's
//     regalia; the brand orange (#fb923c) stays the working accent; the purple
//     glow remains pure atmosphere. Everything on near-black #08070f.
//   · Rank is never encoded by color alone: numerals (01/02/03), Greek ordinal
//     plaques (Α΄/Β΄/Γ΄ ΘΕΣΗ) and position in the composition carry it too.
//   · Spectacle above the fold (champion altar + podium flanks), a clean
//     scrollable ledger from rank 04 down.
import Image from "next/image";
import Link from "next/link";
import { supabaseAdmin } from "@/app/lib/supabase/supabaseAdmin";
import {
  computeGeneralStandings,
  NO_SEASON_LABEL,
  POINTS,
  type SeasonMode,
  type TeamSeasonLine,
} from "./points";
import PointsLog, { type LogTeam } from "./PointsLog";
import MarqueeText from "@/app/home/cards/MarqueeText";
import { Fraunces, Archivo_Black, JetBrains_Mono, Figtree } from "next/font/google";

// ───────────────────────────────────────────────────────────────────────
// Typography (same stack as the live page)
// ───────────────────────────────────────────────────────────────────────
const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

const pad2 = (n: number | string) => String(n).padStart(2, "0");
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

// Ceremonial metals
const GOLD = "#e8c66b";
const GOLD_HI = "#f6e3a8";
const GOLD_LO = "#a8802f";
const SILVER = "#c9ccd6";
const BRONZE = "#d19a6b";
const PAPER = "#F3EFE6";
const INK = "#08070f";

const goldText = {
  backgroundImage: `linear-gradient(180deg, ${GOLD_HI} 0%, ${GOLD} 45%, ${GOLD_LO} 100%)`,
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
} as const;

// ───────────────────────────────────────────────────────────────────────
// Atmosphere — a cathedral of light over near-black
// ───────────────────────────────────────────────────────────────────────
function GrandBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 80% at 50% -10%, #17142a 0%, #0c0b18 42%, #08070f 100%)",
        }}
      />
      {/* apex glow above the champion */}
      <div
        className="absolute left-1/2 top-[-22rem] h-[48rem] w-[80rem] -translate-x-1/2 opacity-[0.22] blur-3xl"
        style={{
          background: `radial-gradient(closest-side, ${GOLD} 0%, rgba(232,198,107,0) 70%)`,
        }}
      />
      {/* brand orange, kept alive at the left edge */}
      <div
        className="absolute -left-52 top-1/4 h-[44rem] w-[44rem] rounded-full opacity-[0.10] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
        }}
      />
      <div
        className="absolute -bottom-64 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.13] blur-3xl"
        style={{
          background: "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
        }}
      />
      {/* stadium light beams falling on the altar */}
      <div
        className="absolute left-1/2 top-0 h-[60rem] w-[110rem] -translate-x-1/2 opacity-[0.08]"
        style={{
          background: `conic-gradient(from 180deg at 50% -8rem,
            transparent 0deg, rgba(246,227,168,0.9) 4deg, transparent 9deg,
            transparent 22deg, rgba(246,227,168,0.7) 26deg, transparent 31deg,
            transparent 329deg, rgba(246,227,168,0.7) 334deg, transparent 338deg,
            transparent 351deg, rgba(246,227,168,0.9) 356deg, transparent 360deg)`,
          maskImage: "linear-gradient(to bottom, black 0%, transparent 78%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, transparent 78%)",
        }}
      />
      {/* hand-set grid, fainter than live */}
      <svg className="absolute inset-0 h-full w-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="grandgrid" width="56" height="56" patternUnits="userSpaceOnUse">
            <path d="M 56 0 L 0 0 0 56" fill="none" stroke={PAPER} strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grandgrid)" />
      </svg>
      {/* vignette so edges fall away */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(4,3,9,0.55) 100%)",
        }}
      />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen text-[#F3EFE6] font-[var(--f-body)] selection:bg-[#e8c66b] selection:text-[#08070f]`}
    >
      <GrandBackground />
      {children}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Ornaments
// ───────────────────────────────────────────────────────────────────────
function LaurelBranch({ flip = false, className = "" }: { flip?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 60 120"
      className={className}
      aria-hidden
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      fill="none"
    >
      <path
        d="M50 116 C 18 96, 8 62, 22 6"
        stroke={GOLD}
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.9"
      />
      {[
        [44, 104, -38], [34, 88, -30], [27, 71, -22], [23, 54, -12], [21, 37, -2], [22, 20, 8],
      ].map(([x, y, r], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}>
          <path
            d="M0 0 C 10 -4, 18 -2, 22 4 C 15 9, 6 8, 0 0 Z"
            fill={GOLD}
            opacity={0.85 - i * 0.06}
          />
          <path
            d="M0 0 C -10 -6, -18 -6, -24 -1 C -18 5, -8 6, 0 0 Z"
            fill={GOLD}
            opacity={0.6 - i * 0.05}
          />
        </g>
      ))}
    </svg>
  );
}

function Diamond({ tone = GOLD }: { tone?: string }) {
  return (
    <span
      aria-hidden
      className="inline-block h-[7px] w-[7px] rotate-45"
      style={{ background: tone }}
    />
  );
}

function RuleWithDiamond() {
  return (
    <div aria-hidden className="flex items-center justify-center gap-4">
      <span className="h-px w-full max-w-[16rem]" style={{ background: `linear-gradient(to right, transparent, ${GOLD})` }} />
      <Diamond />
      <span className="h-px w-full max-w-[16rem]" style={{ background: `linear-gradient(to left, transparent, ${GOLD})` }} />
    </div>
  );
}

function TitleStars({ count, tone = GOLD }: { count: number; tone?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className="font-mono text-[13px] tracking-[0.35em]"
      style={{ color: tone }}
      title={`Τίτλοι · ${count}`}
    >
      {"★".repeat(Math.min(count, 12))}
    </span>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Masthead — centered, monumental
// ───────────────────────────────────────────────────────────────────────
function Masthead({ season, teamCount }: { season: string; teamCount: number }) {
  return (
    <header className="relative">
      <div className="mx-auto max-w-[1400px] px-6 pt-8">
        <nav className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
          <div className="flex items-center gap-2">
            <Link href="/" className="transition-colors hover:text-[#fb923c]">
              Αρχική
            </Link>
            <span>/</span>
            <span className="text-[#F3EFE6]">Γενική Κατάταξη</span>
          </div>
          <span className="hidden border border-[#F3EFE6]/20 bg-[#13131d]/80 px-2.5 py-1 sm:inline-block">
            Ομάδες · {pad2(teamCount)}
          </span>
        </nav>
      </div>

      <div className="mx-auto max-w-[1100px] px-6 pt-12 pb-4 text-center md:pt-16">
        <div className="flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-[#fb923c]">
          <span className="h-px w-10 bg-[#fb923c]/70" />
          Ανά έτος · Ενιαίο σύστημα πόντων
          <span className="h-px w-10 bg-[#fb923c]/70" />
        </div>

        <h1
          className="mt-5 font-[var(--f-display)] font-black italic leading-[0.92] tracking-[-0.03em]"
          style={{ fontSize: "clamp(3rem, 8.5vw, 6.75rem)", ...goldText }}
        >
          Γενική Κατάταξη
        </h1>

        <div className="mt-6">
          <RuleWithDiamond />
          <p className="mt-4 font-mono text-[12px] uppercase tracking-[0.5em] text-[#F3EFE6]/80">
            Σεζόν · <span style={{ color: GOLD }}>{season}</span>
          </p>
        </div>
      </div>
    </header>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Season picker — the epoch selector
// ───────────────────────────────────────────────────────────────────────
function SeasonTabs({
  seasons,
  active,
  basePath,
}: {
  seasons: string[];
  active: string;
  basePath: string;
}) {
  if (seasons.length <= 1) return null;
  return (
    <div className="mb-14 flex flex-wrap items-center justify-center gap-2">
      <span className="mr-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55">
        Σεζόν
      </span>
      {seasons.map((s) => {
        const isActive = s === active;
        return (
          <Link
            key={s}
            href={`${basePath}?season=${encodeURIComponent(s)}`}
            className={`border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors ${
              isActive
                ? "border-[#e8c66b] bg-[#e8c66b] font-bold text-[#08070f]"
                : "border-[#F3EFE6]/25 bg-[#13131d]/80 text-[#F3EFE6]/75 hover:border-[#e8c66b]/70 hover:text-[#e8c66b]"
            }`}
            style={isActive ? { boxShadow: "0 0 22px rgba(232,198,107,0.35)" } : undefined}
          >
            {s}
          </Link>
        );
      })}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Shared bits for podium cards
// ───────────────────────────────────────────────────────────────────────
type TeamInfo = { id: number; name: string | null; logo: string | null };
type RankedLine = TeamSeasonLine & { rank: number };

function TeamCrest({
  team,
  name,
  size,
  ring,
}: {
  team: TeamInfo | undefined;
  name: string;
  size: number;
  ring: string;
}) {
  return (
    <div
      className="relative flex items-center justify-center rounded-full"
      style={{
        width: size + 26,
        height: size + 26,
        background: `radial-gradient(closest-side, rgba(232,198,107,0.16), transparent 72%)`,
        border: `1px solid ${ring}55`,
        boxShadow: `inset 0 0 0 5px ${INK}, inset 0 0 0 6px ${ring}44`,
      }}
    >
      {team?.logo ? (
        <Image
          src={team.logo}
          alt={name}
          width={size}
          height={size}
          className="rounded-full object-cover"
          style={{ width: size, height: size }}
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full border border-[#F3EFE6]/20 bg-[#13131d] font-[var(--f-display)] text-2xl font-black italic text-[#F3EFE6]/60"
          style={{ width: size, height: size }}
        >
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  );
}

/** The compact ledger line every podium card carries — full data, zero mystery. */
function StatLine({ line, tone }: { line: RankedLine; tone: string }) {
  const cell = (label: string, value: React.ReactNode, title: string) => (
    <div className="flex flex-col items-center gap-0.5 px-3 py-2" title={title}>
      <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#F3EFE6]/50">
        {label}
      </span>
      <span className="font-mono text-sm font-bold tabular-nums text-[#F3EFE6]/90">{value}</span>
    </div>
  );
  return (
    <div
      className="grid grid-cols-4 divide-x divide-[#F3EFE6]/10 border-y sm:grid-cols-8"
      style={{ borderColor: `${tone}33` }}
    >
      {cell("Συμ.", line.participations, "Συμμετοχές σε τουρνουά")}
      {cell("Προκ.", line.qualifications, "Προκρίσεις")}
      {cell(
        "Τίτλοι",
        line.titles > 0 ? <span style={{ color: tone }}>{line.titles}</span> : "—",
        "Τίτλοι (νικητής τουρνουά)"
      )}
      {cell("Τελικοί", line.runnerUps > 0 ? line.runnerUps : "—", "Διεκδικητής (φιναλίστ)")}
      {cell("Ν", line.wins, "Νίκες")}
      {cell("Ι", line.draws, "Ισοπαλίες")}
      {cell("Η", line.losses, "Ήττες")}
      {cell(
        "Έξτρα",
        line.adjustmentCount > 0 ? (
          <span className={line.adjustmentPoints >= 0 ? "" : "text-red-400"}>
            {signed(line.adjustmentPoints)}
          </span>
        ) : (
          "—"
        ),
        "Χειροκίνητες προσαρμογές"
      )}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The Champion's Altar — rank 01
// ───────────────────────────────────────────────────────────────────────
function ChampionAltar({
  line,
  team,
  season,
}: {
  line: RankedLine;
  team: TeamInfo | undefined;
  season: string;
}) {
  const name = team?.name ?? `Ομάδα #${line.teamId}`;
  return (
    <section className="relative mb-10">
      {/* season watermark, hand-set behind the altar. Sits low enough to clear the
          season tabs above and reads fully inside the plaque rather than riding up. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-4 select-none overflow-hidden text-center font-[var(--f-display)] font-black italic leading-[1.1] text-[#F3EFE6]"
        style={{ fontSize: "clamp(6rem, 18vw, 15rem)", opacity: 0.05, letterSpacing: "-0.04em" }}
      >
        {season}
      </div>

      <div
        className="relative overflow-hidden border"
        style={{
          borderColor: `${GOLD}66`,
          background:
            "linear-gradient(180deg, rgba(232,198,107,0.10) 0%, rgba(19,19,29,0.85) 34%, rgba(10,10,20,0.92) 100%)",
          boxShadow: `0 0 60px rgba(232,198,107,0.10), inset 0 1px 0 ${GOLD}55`,
        }}
      >
        {/* inner hairline frame — the plaque engraving */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 border"
          style={{ borderColor: `${GOLD}2e` }}
        />

        <div className="relative px-6 pt-10 pb-0 text-center md:pt-12">
          <p className="font-mono text-[11px] uppercase tracking-[0.55em]" style={{ color: GOLD }}>
            1η Θέση
          </p>

          {/* crest between laurels */}
          <div className="mt-6 flex items-end justify-center gap-2 sm:gap-6">
            <LaurelBranch className="h-24 w-12 sm:h-32 sm:w-16" />
            <Link href={`/OMADA/${line.teamId}`} className="group relative -mb-1">
              <TeamCrest team={team} name={name} size={128} ring={GOLD} />
            </Link>
            <LaurelBranch flip className="h-24 w-12 sm:h-32 sm:w-16" />
          </div>

          <Link href={`/OMADA/${line.teamId}`} className="group mt-5 block w-full">
            <h2
              className="mx-auto px-[0.15em] font-[var(--f-display)] font-black italic leading-[1.06] tracking-[-0.02em] transition-opacity group-hover:opacity-80"
              style={{
                fontSize: "clamp(2.4rem, 6.5vw, 5rem)",
                paddingBottom: "0.08em",
              }}
            >
              <MarqueeText className="text-center [&>*]:mx-auto">
                <span style={goldText}>{name}</span>
              </MarqueeText>
            </h2>
          </Link>

          <div className="mt-3 flex items-center justify-center gap-4">
            <TitleStars count={line.titles} />
          </div>

          {/* the number itself, struck like a coin */}
          <div className="mt-6 flex items-baseline justify-center gap-3">
            <span
              className="font-mono font-bold tabular-nums leading-none"
              style={{ fontSize: "clamp(3.5rem, 9vw, 6.5rem)", ...goldText }}
            >
              {line.points}
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.35em] text-[#F3EFE6]/60">
              Πόντοι
            </span>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <StatLine line={line} tone={GOLD} />
          </div>
        </div>

        {/* base of the plinth */}
        <div
          className="mt-0 flex items-center justify-center gap-3 px-6 py-3"
          style={{ background: `linear-gradient(180deg, transparent, ${GOLD}14)` }}
        >
          <Diamond />
          <span className="font-mono text-[9px] uppercase tracking-[0.45em] text-[#F3EFE6]/45">
            Σεζόν {season}
          </span>
          <Diamond />
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Podium flanks — ranks 02 and 03
// ───────────────────────────────────────────────────────────────────────
function PodiumFlank({
  line,
  team,
  ordinal,
  tone,
}: {
  line: RankedLine;
  team: TeamInfo | undefined;
  ordinal: string;
  tone: string;
}) {
  const name = team?.name ?? `Ομάδα #${line.teamId}`;
  return (
    <div
      className="relative overflow-hidden border bg-[#0f0f19]/80"
      style={{ borderColor: `${tone}40`, boxShadow: `inset 0 1px 0 ${tone}40` }}
    >
      <div className="px-5 pt-7 pb-0 text-center">
        <p
          className="font-mono text-[10px] uppercase tracking-[0.45em]"
          style={{ color: tone }}
        >
          {ordinal}
        </p>
        <div className="mt-4 flex items-center justify-center">
          <Link href={`/OMADA/${line.teamId}`}>
            <TeamCrest team={team} name={name} size={72} ring={tone} />
          </Link>
        </div>
        <Link href={`/OMADA/${line.teamId}`} className="group mt-3 block w-full">
          <h3 className="font-[var(--f-display)] text-2xl font-black italic leading-tight text-[#F3EFE6] transition-colors group-hover:text-[#fb923c] md:text-3xl">
            <MarqueeText className="text-center [&>*]:mx-auto">{name}</MarqueeText>
          </h3>
        </Link>
        <div className="mt-1 min-h-[1.25rem]">
          <TitleStars count={line.titles} tone={tone} />
        </div>
        <div className="mt-3 flex items-baseline justify-center gap-2">
          <span className="font-mono text-4xl font-bold tabular-nums" style={{ color: tone }}>
            {line.points}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/55">
            Πόντοι
          </span>
        </div>
        <div className="mt-5">
          <StatLine line={line} tone={tone} />
        </div>
      </div>
      <div className="h-2" style={{ background: `linear-gradient(180deg, transparent, ${tone}22)` }} />
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The Ledger — ranks 04 → N, restrained and legible
// ───────────────────────────────────────────────────────────────────────
function LedgerTable({
  lines,
  teams,
}: {
  lines: RankedLine[];
  teams: Map<number, TeamInfo>;
}) {
  if (lines.length === 0) return null;
  const th =
    "px-3 py-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#F3EFE6]/55";
  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.4em]" style={{ color: GOLD }}>
          Καταστατικό
        </span>
        <span className="h-px flex-1" style={{ background: `linear-gradient(to right, ${GOLD}55, transparent)` }} />
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/45">
          Θέσεις {pad2(lines[0].rank)} — {pad2(lines[lines.length - 1].rank)}
        </span>
      </div>
      <div className="border border-[#F3EFE6]/15 bg-[#0f0f19]/70">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[#F3EFE6]/20 bg-[#13131d]">
                <th className={`${th} w-12 text-left`}>#</th>
                <th className={`${th} text-left`}>Ομάδα</th>
                <th className={`${th} text-center`} title="Συμμετοχές σε τουρνουά">Συμ.</th>
                <th className={`${th} text-center`} title="Προκρίσεις">Προκ.</th>
                <th className={`${th} text-center`} title="Τίτλοι (νικητής τουρνουά)">Τίτλοι</th>
                <th className={`${th} text-center`} title="Διεκδικητής (φιναλίστ)">Τελικοί</th>
                <th className={`${th} text-center`} title="Νίκες">Ν</th>
                <th className={`${th} text-center`} title="Ισοπαλίες">Ι</th>
                <th className={`${th} text-center`} title="Ήττες">Η</th>
                <th className={`${th} text-center`} title="Χειροκίνητες προσαρμογές">Έξτρα</th>
                <th className={`${th} text-right`}>Πόντοι</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((r) => {
                const team = teams.get(r.teamId);
                const name = team?.name ?? `Ομάδα #${r.teamId}`;
                return (
                  <tr
                    key={r.teamId}
                    className="border-b border-[#F3EFE6]/10 transition-colors last:border-b-0 hover:bg-[#e8c66b]/[0.05]"
                  >
                    <td className="px-3 py-2.5">
                      <span className="inline-flex h-7 w-7 items-center justify-center border border-[#F3EFE6]/15 font-mono text-[11px] font-bold tabular-nums text-[#F3EFE6]/70">
                        {pad2(r.rank)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/OMADA/${r.teamId}`} className="group flex items-center gap-3">
                        {team?.logo ? (
                          <Image
                            src={team.logo}
                            alt={name}
                            width={26}
                            height={26}
                            className="h-[26px] w-[26px] shrink-0 rounded-sm object-cover"
                          />
                        ) : (
                          <div className="h-[26px] w-[26px] shrink-0 rounded-sm border border-[#F3EFE6]/15 bg-[#13131d]" />
                        )}
                        <span className="min-w-0 max-w-[220px] font-medium text-[#F3EFE6] transition-colors group-hover:text-[#fb923c]">
                          <MarqueeText>{name}</MarqueeText>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                      {r.participations}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                      {r.qualifications}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.titles > 0 ? (
                        <span className="font-bold" style={{ color: GOLD }}>
                          {r.titles}
                        </span>
                      ) : (
                        <span className="text-[#F3EFE6]/35">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.runnerUps > 0 ? (
                        <span className="text-[#F3EFE6]/90">{r.runnerUps}</span>
                      ) : (
                        <span className="text-[#F3EFE6]/35">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/90">
                      {r.wins}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                      {r.draws}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums text-[#F3EFE6]/75">
                      {r.losses}
                    </td>
                    <td className="px-3 py-2.5 text-center tabular-nums">
                      {r.adjustmentCount > 0 ? (
                        <span className={r.adjustmentPoints >= 0 ? "text-[#F3EFE6]/90" : "text-red-400"}>
                          {signed(r.adjustmentPoints)}
                        </span>
                      ) : (
                        <span className="text-[#F3EFE6]/35">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="font-mono text-base font-bold tabular-nums text-[#F3EFE6]">
                        {r.points}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────
// Points system — the statute plaque, below the spectacle
// ───────────────────────────────────────────────────────────────────────
const RULES: Array<{ label: string; pts: number; manual?: boolean }> = [
  { label: "Συμμετοχή σε τουρνουά", pts: POINTS.participation },
  { label: "Πρόκριση σε επόμενη φάση", pts: POINTS.qualification },
  { label: "Νικητής τουρνουά", pts: POINTS.tournamentWinner },
  { label: "Διεκδικητής (φιναλίστ)", pts: POINTS.runnerUp },
  { label: "Διεθνής διάκριση", pts: POINTS.international, manual: true },
  { label: "Διεθνής συμμετοχή", pts: POINTS.internationalParticipation, manual: true },
  { label: "Νίκη", pts: POINTS.win },
  { label: "Ισοπαλία", pts: POINTS.draw },
  { label: "Ήττα", pts: POINTS.loss },
  { label: "Αποχώρηση από τουρνουά", pts: POINTS.withdrawal, manual: true },
  { label: "Διακοπή αγώνα (υπαίτιος)", pts: POINTS.abandonment, manual: true },
];

// A quiet statute footnote below the ledger — a calm inline list of rule +pts
// pairs, always visible. No grid of tiles, no loud numerals competing with the
// standings table above it.
function PointsLegend() {
  return (
    <section className="mt-8 border-t border-[#F3EFE6]/10 pt-4">
      <h2 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/50">
        <span aria-hidden style={{ color: GOLD }}>
          ◆
        </span>
        Σύστημα πόντων
      </h2>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-[#F3EFE6]/55">
        {RULES.map((r) => (
          <span key={r.label} className="whitespace-nowrap">
            {r.label}
            {r.manual && <span className="text-[#fb923c]">*</span>}{" "}
            <span
              className={`font-mono tabular-nums ${
                r.pts >= 0 ? "text-[#F3EFE6]/80" : "text-red-400"
              }`}
            >
              {signed(r.pts)}
            </span>
          </span>
        ))}
      </div>
      <p className="mt-2.5 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F3EFE6]/35">
        * χειροκίνητη καταχώρηση · η κατάταξη μηδενίζει κάθε σεζόν
      </p>
    </section>
  );
}

function StateBlock({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return (
    <div
      className="relative border-2 border-dashed border-[#F3EFE6]/25 p-12 text-center"
      style={{ background: "rgba(19,19,29,0.4)" }}
    >
      <div className="mx-auto max-w-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]">
          / 00 · {kicker}
        </span>
        <p className="mt-4 font-[var(--f-display)] text-3xl font-black italic leading-tight text-[#F3EFE6]">
          {title}
        </p>
        <p className="mt-3 font-[var(--f-body)] text-sm text-[#F3EFE6]/60">{body}</p>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// View
// ───────────────────────────────────────────────────────────────────────
export interface StandingsViewGrandProps {
  /** Which season model to use. "field" = live, "date" = Sept 30 cutoff (preview). */
  seasonMode: SeasonMode;
  /** Base route the season tabs link to. */
  basePath: string;
  /** Requested ?season= value (already un-arrayed). */
  requestedSeason?: string;
  /** Optional banner rendered above the standings. */
  banner?: React.ReactNode;
}

export default async function StandingsViewGrand({
  seasonMode,
  basePath,
  requestedSeason,
  banner,
}: StandingsViewGrandProps) {
  const requested = requestedSeason?.trim();

  const [standings, teamsRes] = await Promise.all([
    computeGeneralStandings({ seasonMode }),
    supabaseAdmin.from("teams").select("id, name, logo"),
  ]);

  const teams = new Map<number, TeamInfo>(
    ((teamsRes.data ?? []) as TeamInfo[]).map((t) => [t.id, t])
  );

  const season =
    requested && standings.seasons.includes(requested)
      ? requested
      : standings.seasons.find((s) => s !== NO_SEASON_LABEL) ?? standings.seasons[0] ?? "—";

  const lines = standings.bySeason.get(season) ?? [];
  const seasonEvents = standings.events.filter(
    (e) => e.season === season && !e.cancelsSourceKey
  );
  const logTeams: Record<number, LogTeam> = Object.fromEntries(
    [...teams].map(([id, t]) => [id, { name: t.name ?? `Ομάδα #${id}`, logo: t.logo }])
  );

  // Dense rank: teams with equal points share a rank.
  let lastPts: number | null = null;
  let rank = 0;
  const ranked: RankedLine[] = lines.map((l) => {
    if (lastPts === null || l.points !== lastPts) {
      rank += 1;
      lastPts = l.points;
    }
    return { ...l, rank };
  });

  // Podium split. Dense ranking means ties can put several teams on one step —
  // every co-holder gets the full ceremonial treatment.
  const champions = ranked.filter((r) => r.rank === 1);
  const seconds = ranked.filter((r) => r.rank === 2);
  const thirds = ranked.filter((r) => r.rank === 3);
  const rest = ranked.filter((r) => r.rank >= 4);

  return (
    <Shell>
      <Masthead season={season} teamCount={ranked.length} />

      <section className="relative">
        <div className="mx-auto max-w-[1400px] px-6 pt-8 pb-10 md:pb-14">
          {banner}
          <SeasonTabs seasons={standings.seasons} active={season} basePath={basePath} />

          {ranked.length === 0 ? (
            <StateBlock
              kicker="Κατάταξη"
              title="Δεν υπάρχουν δεδομένα"
              body="Η γενική κατάταξη θα εμφανιστεί μόλις ολοκληρωθούν οι πρώτοι αγώνες της σεζόν."
            />
          ) : (
            <>
              <div className="mx-auto max-w-[1100px]">
                {champions.map((c) => (
                  <ChampionAltar
                    key={c.teamId}
                    line={c}
                    team={teams.get(c.teamId)}
                    season={season}
                  />
                ))}

                {(seconds.length > 0 || thirds.length > 0) && (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    {seconds.map((l) => (
                      <PodiumFlank
                        key={l.teamId}
                        line={l}
                        team={teams.get(l.teamId)}
                        ordinal="2η Θέση"
                        tone={SILVER}
                      />
                    ))}
                    {thirds.map((l) => (
                      <PodiumFlank
                        key={l.teamId}
                        line={l}
                        team={teams.get(l.teamId)}
                        ordinal="3η Θέση"
                        tone={BRONZE}
                      />
                    ))}
                  </div>
                )}
              </div>

              <LedgerTable lines={rest} teams={teams} />
              <PointsLegend />
              <PointsLog events={seasonEvents} teams={logTeams} />
            </>
          )}

          <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.15em] text-[#F3EFE6]/40">
            Οι πόντοι υπολογίζονται αυτόματα από τα τουρνουά και τους αγώνες κάθε σεζόν.
            {!standings.adjustmentsAvailable &&
              " · Οι χειροκίνητες προσαρμογές θα ενεργοποιηθούν με την επόμενη ενημέρωση της βάσης."}
          </p>
        </div>
      </section>

      <footer className="border-t border-[#e8c66b]/25 bg-[#0c0b16] text-[#F3EFE6]">
        <div className="mx-auto flex max-w-[1400px] flex-col items-start justify-between gap-4 px-6 py-6 md:flex-row md:items-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/60">
            Γενική Κατάταξη · Σεζόν {season}
          </p>
          <Link
            href="/"
            className="border border-[#F3EFE6]/30 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6] transition-colors hover:bg-[#F3EFE6] hover:text-[#0a0a14]"
          >
            ← Επιστροφή στην Αρχική
          </Link>
        </div>
      </footer>
    </Shell>
  );
}
