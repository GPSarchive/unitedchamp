"use client";
// The «Αγώνες» tab (owner, 2026-11-16: the strip of match days + team filter
// from uefa.com / fotmob.com, drawn as plainly as the Premier League's and BBC
// Sport's fixtures pages, no kitsch):
//
//   1. the teams' crests in one row at the top (sideways on a phone), «Όλες»
//      first. Tap a crest: the list becomes that team's whole tournament,
//      results and fixtures in date order. Tap it again, or «Όλες», to go back;
//   2. a strip of only the days that have matches, opening on the next one;
//   3. that day's matches under one date heading, flat rows on one surface;
//   4. each knockout stage's tree (drawn on the server, passed in as `trees`).
//
// One accent (orange) and only for what is chosen (the day, the team) and the
// winning score. No frames, no italics, no shadows. Client state over plain
// data, so the page stays ISR.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { formatMatchDate, nowWallClockIso } from "@/app/lib/datetime";
import { layers } from "@/app/lib/ui/flat";
import type { TTeam } from "@/app/preview/tournaments-v3/[id]/model";
import { matchdayLabel, openingDay, stageRuns, teamMatches, toDays, type Day, type StageInfo, type ViewMatch } from "./model";
import { Crest } from "../ui";
import { Row } from "./Row";

const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

/** The tab's colours. The page around it is dark (#0a0a14, ivory ink); the list sits on a slightly lifted surface. */
const PALETTE = {
  "--mc-panel": "#12121e",
  "--mc-ink": "#F3EFE6",
  "--mc-muted": "rgba(243,239,230,0.62)",
  "--mc-faint": "rgba(243,239,230,0.4)",
  "--mc-line": "rgba(243,239,230,0.08)",
  "--mc-line-strong": "rgba(243,239,230,0.16)",
  "--mc-box": "rgba(243,239,230,0.08)",
  "--mc-hover": "rgba(243,239,230,0.04)",
  "--mc-win": "#fb923c",
} as React.CSSProperties;


const longDay = (date: string | null) =>
  date ? formatMatchDate(date, { weekday: "long", day: "numeric", month: "long" }) : "Χωρίς ημερομηνία";

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A team's name short enough to stand under its crest: its first word, or the first two when the first is a tag («FC»). */
function shortName(name: string) {
  const words = name.trim().split(/\s+/);
  return words[0].length <= 3 && words[1] ? `${words[0]} ${words[1]}` : words[0];
}

/** Keep the chosen item of a sideways row in view, in the middle where it can be. */
function useCentred(selector: string | null) {
  const frame = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    const el = frame.current;
    if (!el || !selector) return;
    const item = el.querySelector<HTMLElement>(selector);
    if (!item) return;
    const box = el.getBoundingClientRect();
    const at = item.getBoundingClientRect();
    if (el.scrollWidth <= el.clientWidth) return;
    const left = el.scrollLeft + at.left - box.left - (box.width - at.width) / 2;
    el.scrollTo({ left: Math.max(0, left), behavior: first.current || reducedMotion() ? "auto" : "smooth" });
    first.current = false;
  }, [selector]);
  return frame;
}

const SCROLLER = "-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden";

// ───────────────────────────────────────────────────────────────────────
// 1 — the teams
// ───────────────────────────────────────────────────────────────────────

function TeamItem({
  selected,
  dimmed,
  label,
  title,
  onPick,
  dataTeam,
  children,
}: {
  selected: boolean;
  dimmed: boolean;
  label: string;
  title: string;
  onPick: () => void;
  dataTeam: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      data-team={dataTeam}
      aria-pressed={selected}
      aria-label={title}
      title={title}
      onClick={onPick}
      className={`group flex w-[4.25rem] shrink-0 md:w-16 flex-col items-center gap-1.5 rounded-lg pb-2 pt-2 transition-[opacity,background-color] motion-reduce:transition-none ${FOCUS} ${
        selected ? "bg-[#F3EFE6]/[0.08]" : "hover:bg-[#F3EFE6]/[0.04]"
      } ${dimmed ? "opacity-40 hover:opacity-80" : ""}`}
    >
      <span className="flex h-10 w-10 items-center justify-center">{children}</span>
      <span
        className={`max-w-full truncate px-1 text-[12px] leading-tight ${
          selected ? "font-bold text-[#F3EFE6]" : "text-[#F3EFE6]/70"
        }`}
      >
        {label}
      </span>
      {/* The mark of the chosen one. */}
      <span aria-hidden className={`h-[3px] w-6 rounded-full ${selected ? "bg-[#fb923c]" : "bg-transparent"}`} />
    </button>
  );
}

function TeamRow({ teams, team, onPick }: { teams: TTeam[]; team: number | null; onPick: (id: number | null) => void }) {
  const frame = useCentred(team !== null ? `[data-team="${team}"]` : null);
  return (
    <div ref={frame} className={SCROLLER}>
      <div role="group" aria-label="Ομάδες" className="flex w-max gap-1 pr-4 md:w-auto md:flex-wrap md:justify-center md:gap-0.5 md:pr-0">
        <TeamItem
          selected={team === null}
          dimmed={false}
          label="Όλες"
          title="Όλες οι ομάδες"
          onPick={() => onPick(null)}
          dataTeam="all"
        >
          {/* Four of the crests, small: "all the teams" without a word or an icon. */}
          <span className="grid grid-cols-2 gap-0.5">
            {teams.slice(0, 4).map((t) => (
              <Crest key={t.id} team={t} className="h-[18px] w-[18px] text-[8px]" sizes="18px" />
            ))}
          </span>
        </TeamItem>
        {teams.map((t) => {
          const on = t.id === team;
          return (
            <TeamItem
              key={t.id}
              selected={on}
              dimmed={team !== null && !on}
              label={shortName(t.name)}
              title={t.name}
              onPick={() => onPick(on ? null : t.id)}
              dataTeam={String(t.id)}
            >
              <Crest team={t} className="h-10 w-10 text-[15px]" sizes="40px" />
            </TeamItem>
          );
        })}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// 2 — the days
// ───────────────────────────────────────────────────────────────────────

function DayButton({ day, selected, today, onPick }: { day: Day; selected: boolean; today: boolean; onPick: () => void }) {
  const played = day.matches.every((vm) => vm.m.status === "finished");
  return (
    <button
      type="button"
      data-day={day.key}
      aria-pressed={selected}
      aria-label={`${longDay(day.date)}${today ? ", σήμερα" : ""}`}
      onClick={onPick}
      className={`flex h-[4.25rem] shrink-0 flex-col items-center justify-center rounded-lg leading-none transition-colors motion-reduce:transition-none ${FOCUS} ${
        day.date ? "w-[3.5rem]" : "w-[4.5rem]"
      } ${
        selected
          ? "bg-[#F3EFE6] text-[#0a0a14]"
          : `hover:bg-[#F3EFE6]/[0.06] ${played ? "text-[#F3EFE6]/55" : "text-[#F3EFE6]"}`
      }`}
    >
      {day.date ? (
        <>
          <span className={`text-[12px] ${today ? "font-bold" : ""} ${today && !selected ? "text-[#fb923c]" : ""}`}>
            {today ? "Σήμερα" : formatMatchDate(day.date, { weekday: "short" })}
          </span>
          <span className="mt-1.5 text-[1.3rem] font-bold tabular-nums">{formatMatchDate(day.date, { day: "numeric" })}</span>
          <span className="mt-1.5 text-[12px]">{formatMatchDate(day.date, { month: "short" })}</span>
        </>
      ) : (
        <span className="px-1 text-center text-[12px] font-semibold leading-tight">Χωρίς ημερομηνία</span>
      )}
    </button>
  );
}

function DayStrip({
  days,
  stages,
  selected,
  todayKey,
  onPick,
}: {
  days: Day[];
  stages: StageInfo[];
  selected: string | null;
  todayKey: string;
  onPick: (key: string) => void;
}) {
  const frame = useCentred(selected ? `[data-day="${selected}"]` : null);
  const runs = stageRuns(days);
  const tagged = stages.length > 1;
  // On a desk (no swipe) two arrows page the strip; each goes quiet at its end.
  const [ends, setEnds] = useState({ start: true, end: true });
  const measure = () => {
    const el = frame.current;
    if (el) setEnds({ start: el.scrollLeft <= 1, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 });
  };
  useEffect(measure, [frame]);
  const page = (dir: 1 | -1) => {
    const el = frame.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reducedMotion() ? "auto" : "smooth" });
  };
  return (
    <div className="flex min-w-0 items-end gap-2">
      <Arrow dir={-1} disabled={ends.start} onClick={() => page(-1)} />
    <div ref={frame} onScroll={measure} className={`${SCROLLER} min-w-0 flex-1`}>
      <div role="group" aria-label="Ημέρες αγώνων" className="flex w-max items-end pr-4">
        {runs.map((run, index) => (
          <div
            key={`${run.stage}-${index}`}
            className={`flex flex-col gap-1.5 ${index > 0 ? "ml-3 border-l border-[#F3EFE6]/15 pl-3" : ""}`}
          >
            {tagged ? (
              // The stage these days belong to, quietly, over them.
              <span className="sticky left-0 w-0 min-w-full truncate px-1 text-[12px] leading-none text-[#F3EFE6]/55">
                {stages[run.stage]?.title ?? ""}
              </span>
            ) : null}
            <div className="flex gap-1">
              {run.days.map((day) => (
                <DayButton
                  key={day.key}
                  day={day}
                  selected={day.key === selected}
                  today={day.key === todayKey}
                  onPick={() => onPick(day.key)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
      <Arrow dir={1} disabled={ends.end} onClick={() => page(1)} />
    </div>
  );
}

function Arrow({ dir, disabled, onClick }: { dir: 1 | -1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Προηγούμενες ημέρες" : "Επόμενες ημέρες"}
      className={`mb-4 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F3EFE6]/[0.08] text-[#F3EFE6] transition-colors hover:bg-[#F3EFE6]/[0.16] disabled:opacity-25 disabled:hover:bg-[#F3EFE6]/[0.08] motion-reduce:transition-none md:flex ${FOCUS}`}
    >
      <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
        <path d={dir < 0 ? "M7.5 2 3.5 6l4 4" : "M4.5 2l4 4-4 4"} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// ───────────────────────────────────────────────────────────────────────
// 3 — the list
// ───────────────────────────────────────────────────────────────────────

/**
 * The heading of a part of a day: the knockout round (with its stage's name
 * when two knockout stages are played side by side), else the group, else the
 * stage when there are several.
 */
function partTitle(vm: ViewMatch, stages: StageInfo[], twoTrees: boolean) {
  const stage = stages.length > 1 ? (stages[vm.stage]?.title ?? null) : null;
  if (vm.round) return twoTrees && stage ? `${stage} · ${vm.round}` : vm.round;
  return (vm.m.leg == null ? vm.note : null) ?? stage;
}

/** Whether matches of more than one knockout stage are listed. */
const severalTrees = (matches: ViewMatch[]) => new Set(matches.filter((vm) => vm.round).map((vm) => vm.stage)).size > 1;

/** Under a row: its matchday and a leg's name; a group's name goes into the part's heading instead. */
const rowNote = (vm: ViewMatch) =>
  [matchdayLabel(vm.m), vm.m.leg != null ? vm.note : null].filter(Boolean).join(" · ") || null;

function Parts({ matches, stages, now, twoTrees }: { matches: ViewMatch[]; stages: StageInfo[]; now: string; twoTrees: boolean }) {
  const parts: { key: string; title: string | null; matches: ViewMatch[] }[] = [];
  for (const vm of matches) {
    const title = partTitle(vm, stages, twoTrees);
    const last = parts[parts.length - 1];
    if (last && last.title === title) last.matches.push(vm);
    else parts.push({ key: `${title}-${vm.m.id}`, title, matches: [vm] });
  }
  const titled = parts.some((p) => p.title);
  return (
    <>
      {parts.map((part) => (
        <div key={part.key}>
          {titled && part.title ? (
            <h3 className="px-3 pb-1 pt-3 text-[13px] font-semibold text-[var(--mc-muted)] md:px-5">{part.title}</h3>
          ) : null}
          <ul>
            {part.matches.map((vm) => (
              <Row key={vm.m.id} vm={vm} now={now} note={rowNote(vm)} />
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function Surface({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl bg-[var(--mc-panel)] text-[var(--mc-ink)]" style={{ boxShadow: layers("#fb923c") }}>
      {children}
    </div>
  );
}

function DayList({ day, stages, now, twoTrees }: { day: Day; stages: StageInfo[]; now: string; twoTrees: boolean }) {
  return (
    <Surface>
      <h2 className="px-3 pb-2 pt-4 text-[17px] font-bold leading-tight first-letter:uppercase md:px-5 md:text-lg">
        {longDay(day.date)}
      </h2>
      <Parts matches={day.matches} stages={stages} now={now} twoTrees={twoTrees} />
    </Surface>
  );
}

/** One team's whole tournament, in date order: each day's heading, then its match. */
function TeamList({
  team,
  matches,
  stages,
  now,
  onClear,
}: {
  team: TTeam;
  matches: ViewMatch[];
  stages: StageInfo[];
  now: string;
  onClear: () => void;
}) {
  const days = toDays(teamMatches(matches, team.id));
  const twoTrees = severalTrees(matches);
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Crest team={team} className="h-9 w-9 text-[15px]" sizes="36px" />
        <h2 className="min-w-0 flex-1 text-xl font-bold leading-tight [overflow-wrap:anywhere]">{team.name}</h2>
        <button
          type="button"
          onClick={onClear}
          aria-label="Όλοι οι αγώνες"
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F3EFE6]/[0.08] text-[#F3EFE6]/80 transition-colors hover:bg-[#F3EFE6]/[0.14] hover:text-[#F3EFE6] motion-reduce:transition-none ${FOCUS}`}
        >
          <svg aria-hidden viewBox="0 0 14 14" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M2 2l10 10M12 2 2 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <Surface>
        {days.map((day, index) => (
          <section key={day.key} className={index > 0 ? "border-t border-[var(--mc-line)]" : ""}>
            <h3 className="px-3 pb-0 pt-3 text-[13px] font-semibold text-[var(--mc-muted)] first-letter:uppercase md:px-5">
              {day.date ? formatMatchDate(day.date, { weekday: "long", day: "numeric", month: "long" }) : "Χωρίς ημερομηνία"}
              {(() => {
                const extra = [...new Set(day.matches.map((vm) => partTitle(vm, stages, twoTrees)).filter(Boolean))];
                return extra.length ? <span className="font-normal">{` · ${extra.join(", ")}`}</span> : null;
              })()}
            </h3>
            <ul>
              {day.matches.map((vm) => (
                <Row key={vm.m.id} vm={vm} now={now} note={rowNote(vm)} />
              ))}
            </ul>
          </section>
        ))}
      </Surface>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// The tab
// ───────────────────────────────────────────────────────────────────────

export default function MatchesClient({
  matches,
  stages,
  teams,
  serverNow,
  trees,
}: {
  matches: ViewMatch[];
  stages: StageInfo[];
  teams: TTeam[];
  /** The Athens wall-clock when the page was rendered; the browser's own replaces it once it runs. */
  serverNow: string;
  /** The knockout trees, drawn on the server. */
  trees: React.ReactNode;
}) {
  const [now, setNow] = useState(serverNow);
  const [team, setTeam] = useState<number | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  // An ISR page can be minutes old: "next" is decided again by the reader's clock.
  useEffect(() => {
    setNow(nowWallClockIso());
  }, []);

  const days = useMemo(() => toDays(matches), [matches]);
  const twoTrees = useMemo(() => severalTrees(matches), [matches]);
  const day = picked ?? openingDay(days, now);
  const selectedDay = days.find((d) => d.key === day) ?? null;
  const chosen = team !== null ? (teams.find((t) => t.id === team) ?? null) : null;

  // Choosing or clearing a team brings the list's top back into view.
  const top = useRef<HTMLDivElement>(null);
  const pickTeam = (id: number | null) => {
    setTeam(id);
    const el = top.current;
    if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
  };

  if (matches.length === 0) {
    return <p className="text-[17px] text-[#F3EFE6]/70">Οι αγώνες της διοργάνωσης δεν έχουν οριστεί ακόμα.</p>;
  }

  return (
    <div style={PALETTE} className="grid grid-cols-[minmax(0,1fr)] gap-10">
      <div ref={top} className="grid min-w-0 scroll-mt-24 grid-cols-[minmax(0,1fr)] gap-5">
        {teams.length > 1 ? <TeamRow teams={teams} team={team} onPick={pickTeam} /> : null}

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4 md:mx-auto md:w-full md:max-w-[46rem]">
          {chosen ? (
            <TeamList team={chosen} matches={matches} stages={stages} now={now} onClear={() => pickTeam(null)} />
          ) : (
            <>
              <DayStrip days={days} stages={stages} selected={day} todayKey={now.slice(0, 10)} onPick={setPicked} />
              {selectedDay ? <DayList day={selectedDay} stages={stages} now={now} twoTrees={twoTrees} /> : null}
            </>
          )}
        </div>
      </div>

      {chosen ? null : trees}
    </div>
  );
}

