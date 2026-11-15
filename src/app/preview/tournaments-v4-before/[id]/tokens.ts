// The look of the old tournament page, as the few class names its pieces
// share. No imports, so both server and client files can take them.
//
//   ground   #0a0a14 (panels), #13131d (the strip at the top of a panel)
//   ink      #F3EFE6 ivory
//   signal   #fb923c orange: what leads, what is active, what was won on the day
//   honours  #E8B931 saffron: the title, and nothing else

/** The data face: small labels, column heads, numbers in a table. */
export const MONO = "font-[family-name:var(--f-mono),ui-monospace,monospace]";

/** The small tracked label: a panel's name, a column head, a tab. */
export const LABEL = `${MONO} text-[11px] uppercase tracking-[0.2em]`;

export const FOCUS =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c]";

/** A bordered button, as the old page's «Όλες οι διοργανώσεις». */
export const BUTTON = `${LABEL} inline-flex h-11 items-center border-2 border-[#F3EFE6]/25 px-4 hover:border-[#fb923c] hover:text-[#fb923c] ${FOCUS}`;
