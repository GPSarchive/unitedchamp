// The look of the tournament pages, as the few class names their pieces share.
// Only lib/ui/flat (which has none), so both server and client files can take them.
//
//   ground   #0a0a14 (the page), #12121e (panels, flat SURFACE), STRIP_TOP (the strip at the top of a panel)
//   ink      #F3EFE6 ivory
//   signal   #fb923c orange: what leads, what comes next, what was won on the day
//   honours  #E8B931 saffron: the title, and nothing else
//
// One typeface, the site's condensed sans. The headings are its bold italic,
// big. Everything small is in plain sentence case, so the loudest words on the
// page are the teams' names (which are kept in capitals).
import { BUTTON_SHAPE } from "@/app/lib/ui/flat";

/** A small quiet line: a count, a column head, what round a match belongs to. Give it a colour. */
export const LABEL = "text-sm leading-tight";

/** The name of a panel, a round, a tab. */
export const NAME = "text-[15px] font-bold leading-tight";

export const SAFFRON = "#E8B931";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

/** A neutral button, as the old page's «Όλες οι διοργανώσεις». */
export const BUTTON = `${NAME} inline-flex h-11 items-center ${BUTTON_SHAPE} px-4 transition-colors hover:text-[#fb923c] ${FOCUS}`;
