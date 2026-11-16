// A match as one flat row, as on a big league's fixtures page: home name,
// crest, the time (or the score) centred in a small quiet box, crest, away
// name. Long names take a second line and never reach the box. The whole row
// opens the match. No hooks.
//
// Colours come from the --mc-* variables set on the tab (MatchesClient), so the
// row sits on whichever surface the tab uses.
import Link from "next/link";
import { formatMatchTime, toNaiveIso } from "@/app/lib/datetime";
import { matchWinner, type TMatch, type TTeam } from "@/app/preview/tournaments-v3/[id]/model";
import type { ViewMatch } from "./model";
import { MATCH_PATH } from "../paths";
import { Crest } from "../ui";

export const FOCUS_RING =
  "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#fb923c]";

function Name({ team, lost, align }: { team: TTeam | null; lost: boolean; align: "left" | "right" }) {
  return (
    <span
      className={`min-w-0 text-[15px] font-semibold leading-[1.2] [overflow-wrap:anywhere] md:text-base ${
        align === "right" ? "text-right" : "text-left"
      } ${!team ? "font-normal text-[var(--mc-faint)]" : lost ? "text-[var(--mc-muted)]" : ""}`}
    >
      {team?.name ?? "Αναμένεται"}
    </span>
  );
}

/** The middle: the score, or the kick-off time, in one small box. */
function Centre({ m, now }: { m: TMatch; now: string }) {
  const box = "flex h-8 min-w-[3.75rem] items-center justify-center rounded-md px-2 tabular-nums md:h-9 md:min-w-[4.25rem]";
  if (m.status === "finished" && m.score) {
    const winner = matchWinner(m);
    const tone = (side: "a" | "b") => (winner === side ? "text-[var(--mc-win)]" : "");
    return (
      <span className="flex flex-col items-center gap-1">
        <span className={`${box} gap-1.5 bg-[var(--mc-box)] text-[17px] font-bold md:text-lg`}>
          <span className={tone("a")}>{m.score.a}</span>
          <span aria-hidden className="font-normal text-[var(--mc-faint)]">
            –
          </span>
          <span className={tone("b")}>{m.score.b}</span>
        </span>
        {m.pens ? (
          <span className="whitespace-nowrap text-[12px] leading-none text-[var(--mc-muted)]">
            πέν. {m.pens.a}–{m.pens.b}
          </span>
        ) : null}
      </span>
    );
  }
  if (!m.date) {
    return <span className={`${box} border border-[var(--mc-line)] text-[var(--mc-faint)]`}>–</span>;
  }
  // Kick-off passed and no result yet: the time stays, stepped back.
  const past = now >= toNaiveIso(m.date);
  return (
    <span
      className={`${box} border border-[var(--mc-line-strong)] text-[15px] font-semibold md:text-base ${
        past ? "text-[var(--mc-muted)]" : ""
      }`}
    >
      {formatMatchTime(m.date)}
    </span>
  );
}

export function Row({ vm, now, note }: { vm: ViewMatch; now: string; note?: string | null }) {
  const { m } = vm;
  const winner = matchWinner(m);
  return (
    <li className="border-t border-[var(--mc-line)] first:border-t-0">
      <Link
        href={`${MATCH_PATH}/${m.id}`}
        className={`block px-3 py-3.5 transition-colors hover:bg-[var(--mc-hover)] motion-reduce:transition-none md:px-5 md:py-4 ${FOCUS_RING}`}
      >
        <span className="grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center gap-2 md:gap-3">
          <Name team={m.a} lost={winner === "b"} align="right" />
          <Crest team={m.a} className="h-6 w-6 text-[11px] md:h-7 md:w-7" sizes="28px" />
          <Centre m={m} now={now} />
          <Crest team={m.b} className="h-6 w-6 text-[11px] md:h-7 md:w-7" sizes="28px" />
          <Name team={m.b} lost={winner === "a"} align="left" />
        </span>
        {note ? <span className="mt-1.5 block text-center text-[13px] leading-none text-[var(--mc-muted)]">{note}</span> : null}
      </Link>
    </li>
  );
}
