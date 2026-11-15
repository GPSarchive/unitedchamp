// The teams as a grid of tiles; a tap on a tile opens that team's squad right
// under the tile's row, as wide as the grid, and a second tap (or «Κλείσιμο»)
// closes it. One squad is open at a time.
//
// The squad is a grid item of its own placed straight after its tile, spanning
// every column; the grid packs densely, so the tiles that come after fill the
// rest of the tile's row and the squad lands under that row whatever the
// number of columns — no measuring. A small notch on the open tile points at
// its squad.
//
// A squad is only put on the page when its tile is opened, so its cards (and
// their photos) cost nothing until then; the cards are dealt in as it appears
// (dispatch.module.css).
"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import styles from "../dispatch.module.css";
import { BUTTON } from "../tokens";

export type TeamEntry = {
  id: number;
  name: string;
  /** What the tile shows (crest, name, standing). */
  tile: React.ReactNode;
  /** The team's squad, shown when the tile is open. */
  squad: React.ReactNode;
  /** The link to the team's own page, shown under its squad. */
  page: React.ReactNode;
};

/**
 * The height of the site's fixed top bar: what an opened team must clear. Its
 * height and not where it is now, because on a desk the bar slides away while
 * the page scrolls down and comes back as soon as it scrolls up.
 */
function fixedBarHeight(): number {
  for (const el of document.querySelectorAll("header")) {
    if (getComputedStyle(el).position === "fixed") return el.offsetHeight;
  }
  return 0;
}

export default function TeamGrid({ teams }: { teams: TeamEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const tiles = useRef(new Map<number, HTMLButtonElement>());

  // The squad opens under the tile's row. When that would start low on the
  // screen (or the tile has slid out of sight because the squad above it
  // closed), bring the tile's row to the top.
  useEffect(() => {
    if (open === null) return;
    const tile = tiles.current.get(open);
    if (!tile) return;
    const rect = tile.getBoundingClientRect();
    const top = fixedBarHeight() + 12;
    if (rect.top < top || rect.bottom > window.innerHeight * 0.5) {
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      window.scrollTo({ top: window.scrollY + rect.top - top, behavior: calm ? "auto" : "smooth" });
    }
  }, [open]);

  const close = (id: number) => {
    setOpen(null);
    // Back to the tile the squad belonged to: the reader is not left where the squad used to be.
    const tile = tiles.current.get(id);
    tile?.focus({ preventScroll: true });
    tile?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="grid grid-flow-row-dense grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {teams.map((team) => {
        const isOpen = open === team.id;
        const squadId = `squad-${team.id}`;
        return (
          <Fragment key={team.id}>
            <button
              type="button"
              ref={(el) => {
                if (el) tiles.current.set(team.id, el);
                else tiles.current.delete(team.id);
              }}
              aria-expanded={isOpen}
              aria-controls={isOpen ? squadId : undefined}
              onClick={() => setOpen(isOpen ? null : team.id)}
              // The scroll margin clears the site's fixed top bar when the tile is scrolled back into view.
              className={`group relative flex min-w-0 scroll-mt-20 flex-col border-2 py-3 pl-4 pr-3 text-left transition-colors md:scroll-mt-36 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c] ${
                isOpen
                  ? "border-[#F3EFE6]/45 bg-[#151522]"
                  : "border-[#F3EFE6]/20 bg-[#0e0e1a] hover:border-[#F3EFE6]/45 hover:bg-[#151522]"
              }`}
            >
              {team.tile}
              <svg
                aria-hidden
                viewBox="0 0 12 12"
                className={`absolute right-3 top-3.5 h-3.5 w-3.5 text-[#F3EFE6]/65 transition-transform duration-200 motion-reduce:transition-none ${
                  isOpen ? "rotate-180" : ""
                }`}
              >
                <path d="M1.5 4 6 8.5 10.5 4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              </svg>
              {/* The notch: a corner standing on the squad's top edge, pointing back at this tile. */}
              {isOpen ? (
                <span
                  aria-hidden
                  className="absolute left-1/2 top-full z-10 mt-[7px] h-3 w-3 -translate-x-1/2 rotate-45 border-l-2 border-t-2 border-[#F3EFE6]/45 bg-[#151522]"
                />
              ) : null}
            </button>

            {isOpen ? (
              <section
                id={squadId}
                aria-label={`Ρόστερ: ${team.name}`}
                className={`${styles.roster} col-span-full min-w-0 border-2 border-[#F3EFE6]/45 bg-[#0e0e1a]`}
              >
                {team.squad}
                <p className="flex flex-wrap gap-2.5 border-t border-[#F3EFE6]/20 px-4 py-4 md:px-5">
                  {team.page}
                  <button type="button" onClick={() => close(team.id)} className={BUTTON}>
                    Κλείσιμο
                  </button>
                </p>
              </section>
            ) : null}
          </Fragment>
        );
      })}
    </div>
  );
}
