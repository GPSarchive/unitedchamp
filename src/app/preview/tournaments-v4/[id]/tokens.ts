// The look of the tournament pages, as the few class names their pieces share.
// No imports, so both server and client files can take them.
//
//   ground   #0a0a14 (the page), #0e0e1a (panels), #151522 (the strip at the top of a panel)
//   ink      #F3EFE6 ivory
//   signal   #fb923c orange: what leads, what comes next, what was won on the day
//   honours  #E8B931 saffron: the title, and nothing else
//
// One typeface, the site's condensed sans. The headings are its bold italic,
// big. Everything small is in plain sentence case, so the loudest words on the
// page are the teams' names (which are kept in capitals).

/** A small quiet line: a count, a column head, what round a match belongs to. Give it a colour. */
export const LABEL = "text-sm leading-tight";

/** The name of a panel, a round, a tab. */
export const NAME = "text-[15px] font-bold leading-tight";

export const SAFFRON = "#E8B931";

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

/** A bordered button, as the old page's «Όλες οι διοργανώσεις». */
export const BUTTON = `${NAME} inline-flex h-11 items-center border-2 border-[#F3EFE6]/25 px-4 transition-colors hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS}`;
