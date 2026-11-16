"use client";
// The knockout tree's frame. Where the tree is wider than the screen (a phone)
// the frame scrolls sideways, and it opens already scrolled to where the
// stage stands, placed so that the first look shows what it is — a knockout:
//
// - still being played: the round being played (`focus`) stands near the left
//   edge, with the line ends of the round before it showing at the edge and
//   the round it leads to cut off on the right, so the pairs can be seen
//   joining and narrowing, and the cut ties on both sides show that the
//   frame goes on;
// - finished (`focus` is the last column): scrolled to the end — the semi-
//   finals joining into the final, the winner's ring standing on it.
//
// No text says any of this (see the glance-test rule). Where the whole tree
// fits, nothing scrolls and nothing moves.
import { useLayoutEffect, useRef } from "react";

export default function TreeScroller({
  focus,
  last,
  className,
  children,
}: {
  /** The column to open on (0 = the first round). */
  focus: number;
  /** The tree's last column. */
  last: number;
  className: string;
  children: React.ReactNode;
}) {
  const frame = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = frame.current;
    if (!el || el.scrollWidth <= el.clientWidth + 1) return;
    if (focus >= last) {
      el.scrollLeft = el.scrollWidth;
      return;
    }
    if (focus <= 0) return;
    const tie = el.querySelector<HTMLElement>(`[data-col="${focus}"]`);
    if (!tie) return;
    const left = tie.getBoundingClientRect().left - el.getBoundingClientRect().left + el.scrollLeft;
    // Leave the round before showing at the edge: its lines and the end of its ties.
    const peek = Math.min(48, el.clientWidth * 0.12);
    el.scrollLeft = Math.max(0, left - peek);
  }, [focus, last]);

  return (
    <div ref={frame} className={className}>
      {children}
    </div>
  );
}
