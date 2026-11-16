"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Mouse-driven 3D tilt for a card, built to cost the browser as little as
 * possible: the hook only writes five CSS variables on the card element, at
 * most once per frame, and the card's styles use them exclusively in
 * `transform` and `opacity` — so a moving mouse never repaints anything, the
 * compositor just moves layers that were painted once.
 *
 *   --rx / --ry   rotation in degrees
 *   --px / --py   pointer position, -1 (left/top) … 1 (right/bottom)
 *   --lit         1 while the card is being tilted, else 0
 *   --tilt-ms     how long layers take to follow (short while moving, long
 *                 when easing back to rest)
 *
 * Nothing runs while the card is idle. Touch is ignored (a finger scrolling
 * past must not tilt the card or block the scroll), and so is everything
 * under prefers-reduced-motion.
 */
export function useCardTilt<T extends HTMLElement>({
  maxDeg = 12,
  /** 1 = the side under the pointer lifts toward the viewer, -1 = it presses in. */
  direction = 1,
  /** Play one short sweep after mount, so the depth shows without a mouse. */
  intro = true,
}: { maxDeg?: number; direction?: 1 | -1; intro?: boolean } = {}) {
  const ref = useRef<T | null>(null);
  const frameRef = useRef(0);
  const introRef = useRef(0);

  const write = useCallback(
    (el: HTMLElement, x: number, y: number, lit: boolean) => {
      const px = x * 2 - 1;
      const py = y * 2 - 1;
      el.style.setProperty("--rx", `${(py * maxDeg * direction).toFixed(2)}deg`);
      el.style.setProperty("--ry", `${(-px * maxDeg * 1.15 * direction).toFixed(2)}deg`);
      el.style.setProperty("--px", px.toFixed(3));
      el.style.setProperty("--py", py.toFixed(3));
      el.style.setProperty("--lit", lit ? "1" : "0");
    },
    [maxDeg, direction],
  );

  const rest = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-ms", "600ms");
    write(el, 0.5, 0.5, false);
  }, [write]);

  const onPointerMove = useCallback(
    (e: React.PointerEvent<T>) => {
      const el = ref.current;
      if (!el || e.pointerType !== "mouse") return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      cancelAnimationFrame(introRef.current);
      const box = el.getBoundingClientRect();
      const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
      const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
      cancelAnimationFrame(frameRef.current);
      frameRef.current = requestAnimationFrame(() => {
        el.style.setProperty("--tilt-ms", "90ms");
        write(el, x, y, true);
      });
    },
    [write],
  );

  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    rest();
  }, [rest]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !intro) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // One sweep from the top-right corner to the centre, then nothing.
    const DURATION = 1400;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      el.style.setProperty("--tilt-ms", "0ms");
      write(el, 0.82 + (0.5 - 0.82) * eased, 0.14 + (0.5 - 0.14) * eased, t < 1);
      if (t < 1) introRef.current = requestAnimationFrame(step);
    };
    introRef.current = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(introRef.current);
      cancelAnimationFrame(frameRef.current);
    };
  }, [intro, write]);

  return { ref, onPointerMove, onPointerLeave };
}

/** Style of the element the hook is attached to. */
export const TILT_STYLE: React.CSSProperties = {
  transform: "perspective(900px) rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg))",
  transition: "transform var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)",
  willChange: "transform",
};
