// The old page's orange strip of next matches, moving across the screen.
// Here every match in it is a link to its page; the strip stops under the
// pointer or the keyboard, and does not move at all for a reader who has asked
// for less motion (dispatch.module.css).
import Link from "next/link";
import { formatMatchDate, formatMatchTime } from "@/app/lib/datetime";
import type { TMatch } from "../../tournaments-v3/[id]/model";
import styles from "./dispatch.module.css";
import { MATCH_PATH } from "./paths";
import { LABEL, MONO } from "./tokens";

/** A copy of the list is at least this many matches long, so the strip has no hole on a wide screen. */
const FILL = 8;
/** Seconds a match takes to cross: the strip's speed does not depend on how many there are. */
const SECONDS_EACH = 7;

export default function Ticker({ matches }: { matches: TMatch[] }) {
  if (matches.length === 0) return null;
  const run = Array.from({ length: Math.ceil(FILL / matches.length) }, () => matches).flat();
  const copy = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined} className={`flex shrink-0 ${hidden ? styles.copy : ""}`}>
      {run.map((m, index) => (
        <li key={`${m.id}-${index}`} className="flex shrink-0 items-center">
          <Link
            href={`${MATCH_PATH}/${m.id}`}
            tabIndex={hidden || index >= matches.length ? -1 : undefined}
            className={`${MONO} flex items-center gap-3 px-5 py-3 text-[12px] uppercase tracking-[0.14em] hover:bg-[#0a0a14]/10 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#0a0a14]`}
          >
            <span>
              {formatMatchDate(m.date, { weekday: "short", day: "numeric", month: "short" })} {formatMatchTime(m.date)}
            </span>
            <span className="font-bold">{m.a?.name ?? "Αναμένεται"}</span>
            <span aria-hidden className="opacity-60">
              vs
            </span>
            <span className="sr-only">εναντίον</span>
            <span className="font-bold">{m.b?.name ?? "Αναμένεται"}</span>
          </Link>
          <span aria-hidden className="h-3 w-[2px] bg-[#0a0a14]/35" />
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label="Επόμενοι αγώνες" className="flex items-stretch border-y-2 border-[#0a0a14] bg-[#fb923c] text-[#0a0a14]">
      <p className={`${LABEL} flex shrink-0 items-center bg-[#13131d] px-4 font-bold text-[#fb923c] md:px-6`}>Επόμενοι</p>
      <div className={`${styles.ticker} min-w-0 flex-1`}>
        <div className={styles.track} style={{ "--time": `${run.length * SECONDS_EACH}s` } as React.CSSProperties}>
          {copy(false)}
          {copy(true)}
        </div>
      </div>
    </section>
  );
}
