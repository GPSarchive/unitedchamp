// How far away the next kick-off is: «Σήμερα» / «Αύριο» / «σε 6 μέρες» and a
// live countdown. `kickoffMs` is the real instant of the Athens kick-off
// (clock.kickoffEpoch), so the count is right in any browser time zone.
//
// The page is cached and served for a while, so nothing here is rendered from
// the server's clock: the label and the digits appear once the browser has
// mounted the component (which also keeps hydration stable).
"use client";

import { useEffect, useState } from "react";
import { countdownParts, dayLabel } from "./clock";
import { layers } from "@/app/lib/ui/flat";

const two = (v: number) => String(v).padStart(2, "0");

export default function Kickoff({ kickoffMs, date }: { kickoffMs: number; date: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const c = now === null ? null : countdownParts(kickoffMs, now);
  if (c?.done) {
    return <p className="text-[15px] font-bold text-[color:var(--team)]">Η σέντρα έγινε.</p>;
  }
  const label = now === null ? "" : dayLabel(date, new Date(now));
  const cells: [value: string, unit: string][] = [
    [c ? String(c.days) : "–", c?.days === 1 ? "μέρα" : "μέρες"],
    [c ? two(c.hours) : "––", "ώρες"],
    [c ? two(c.minutes) : "––", "λεπτά"],
    [c ? two(c.seconds) : "––", "δευτ."],
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div
        role="timer"
        aria-label={c ? `Σέντρα σε ${c.days} μέρες, ${c.hours} ώρες και ${c.minutes} λεπτά` : "Αντίστροφη μέτρηση"}
        className="flex gap-px overflow-hidden rounded-xl bg-[#F3EFE6]/[0.08]"
        style={{ boxShadow: layers("var(--team)") }}
      >
        {cells.map(([value, unit]) => (
          <div key={unit} aria-hidden className="min-w-[3.6rem] bg-[#12121e] px-2 py-2 text-center">
            <b className="block text-2xl font-bold leading-none tabular-nums">{value}</b>
            <span className="mt-1.5 block text-[13px] leading-none text-[#F3EFE6]/65">{unit}</span>
          </div>
        ))}
      </div>
      {label ? (
        <span className="rounded-md bg-[color:var(--team)] px-2.5 py-1 text-[15px] font-bold text-[color:var(--team-ink)]">
          {label}
        </span>
      ) : null}
    </div>
  );
}
