"use client";

import { useEffect, useMemo, useRef } from "react";

type Props = {
  paths: string[];
  /** base hairline width (px) */
  baseWidth?: number;           // default 2
  /** specular (white) highlight width (px) */
  specWidth?: number;           // default 2
  /** length of the bright glint (px along path) */
  glintLen?: number;            // default 22
  /** length of the softer tail following the glint (px) */
  tailLen?: number;             // default 60
  /** per-path speed range in px/s [min,max] */
  speedRange?: [number, number]; // default [220, 320]
  /** gradient stops for the track (aligned start->end of each path) */
  colorStops?: string[];        // default ["#fb923c","#f59e0b","#ef4444"]
  /** faint outer glow intensity (0..1); set 0 to disable */
  glow?: number;                // default 0.15
};

type Cubic = {
  ax: number; ay: number;
  cx1: number; cy1: number;
  cx2: number; cy2: number;
  bx: number; by: number;
  len: number;                  // approx path length
  grad: CanvasGradient | null;  // gradient along chord
  seed: number;                 // deterministic per-path
};

const parseCubic = (d: string): Omit<Cubic, "len" | "grad" | "seed"> | null => {
  // "M ax ay C cx1 cy1 cx2 cy2 bx by"
  const m = d.match(
    /M\s*([-\d.]+)\s+([-\d.]+)\s*C\s*([-\d.]+)\s+([-\d.]+)\s*([-\d.]+)\s+([-\d.]+)\s*([-\d.]+)\s+([-\d.]+)/i
  );
  if (!m) return null;
  const [, ax, ay, cx1, cy1, cx2, cy2, bx, by] = m.map(Number) as any;
  return { ax, ay, cx1, cy1, cx2, cy2, bx, by };
};

const cubicPoint = (t: number, s: Omit<Cubic, "len" | "grad" | "seed">) => {
  const u = 1 - t;
  const x =
    u * u * u * s.ax +
    3 * u * u * t * s.cx1 +
    3 * u * t * t * s.cx2 +
    t * t * t * s.bx;
  const y =
    u * u * u * s.ay +
    3 * u * u * t * s.cy1 +
    3 * u * t * t * s.cy2 +
    t * t * t * s.by;
  return { x, y };
};

const approxLength = (s: Omit<Cubic, "len" | "grad" | "seed">, steps = 64) => {
  let len = 0;
  let prev = cubicPoint(0, s);
  for (let i = 1; i <= steps; i++) {
    const p = cubicPoint(i / steps, s);
    const dx = p.x - prev.x, dy = p.y - prev.y;
    len += Math.hypot(dx, dy);
    prev = p;
  }
  return len;
};

// simple deterministic PRNG from an index
const seedRand = (i: number) => {
  let x = Math.sin(i * 99991) * 10000;
  return () => {
    x = Math.sin(x) * 10000;
    return x - Math.floor(x);
  };
};

export default function CanvasBacklight({
  paths,
  baseWidth = 2,
  specWidth = 2,
  glintLen = 22,
  tailLen = 60,
  speedRange = [220, 320],
  colorStops = ["#fb923c", "#f59e0b", "#ef4444"],
  glow = 0.15,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const reducedMotion = useRef<boolean>(
    typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  // parse, measure, and assign per-path phase + speed
  const segments = useMemo(() => {
    return paths
      .map(parseCubic)
      .map((s, i) => {
        if (!s) return null;
        const len = approxLength(s);
        // phase offset per path so glints are scattered
        const r = seedRand(i);
        return {
          ...s,
          len,
          grad: null,
          seed: r(), // keep 0..1 number we can reuse for phase/speed
        } as Cubic;
      })
      .filter(Boolean) as Cubic[];
  }, [paths]);

  // Resize canvas to CSS size * DPR
  const resizeToContainer = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
    }
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    resizeToContainer();

    const ro = new ResizeObserver(() => resizeToContainer());
    ro.observe(canvas);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // build a gradient aligned to each path’s chord
    const ensureGradients = () => {
      segments.forEach((s) => {
        if (s.grad) return;
        const g = ctx.createLinearGradient(s.ax, s.ay, s.bx, s.by);
        const n = Math.max(2, colorStops.length);
        for (let i = 0; i < n; i++) {
          g.addColorStop(i / (n - 1), colorStops[Math.min(i, colorStops.length - 1)]);
        }
        s.grad = g;
      });
    };

    ensureGradients();

    let last = performance.now();
    const speeds = segments.map((s, i) => {
      const [minS, maxS] = speedRange;
      return minS + (maxS - minS) * (s.seed ?? (i % 10) / 10); // px/sec
    });
    const offsets = segments.map((s, i) => {
      // randomize start offset so they begin at different positions
      return - (s.seed * s.len);
    });

    const drawSegment = (s: Cubic) => {
      ctx.beginPath();
      ctx.moveTo(s.ax, s.ay);
      ctx.bezierCurveTo(s.cx1, s.cy1, s.cx2, s.cy2, s.bx, s.by);
    };

    const drawFrame = (now: number) => {
      const dt = Math.min(50, now - last) / 1000; // seconds
      last = now;

      const rect = canvas.getBoundingClientRect();
      const w = rect.width, h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // 1) base track (thin & crisp)
      segments.forEach((s) => {
        if (!s.grad) return;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.lineWidth = baseWidth;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = s.grad!;
        if (glow > 0) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = "rgba(239, 68, 68, 0.35)"; // red-500-ish
          ctx.globalAlpha = 0.85 + glow * 0.1;
        }
        drawSegment(s);
        ctx.stroke();
        ctx.restore();
      });

      if (!reducedMotion.current) {
        // 2) per-path glints (dash with huge gap) + tail + white specular
        segments.forEach((s, i) => {
          const L = Math.max(10, s.len);
          // advance offset
          offsets[i] -= speeds[i] * dt;
          // keep it bounded
          if (offsets[i] < -L) offsets[i] += L;

          // main glint
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = s.grad!;
          ctx.lineWidth = Math.max(baseWidth + 2, 4);
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.setLineDash([glintLen, L]); // one bright dash
          ctx.lineDashOffset = offsets[i];
          drawSegment(s);
          ctx.stroke();
          ctx.restore();

          // soft tail (behind the glint)
          ctx.save();
          ctx.globalCompositeOperation = "lighter";
          ctx.strokeStyle = s.grad!;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = Math.max(baseWidth + 2, 4);
          ctx.lineCap = "round";
          ctx.setLineDash([tailLen, L]);
          ctx.lineDashOffset = offsets[i] + glintLen * 0.6; // trail behind
          drawSegment(s);
          ctx.stroke();
          ctx.restore();

          // white specular streak on top of the glint
          ctx.save();
          ctx.globalCompositeOperation = "screen";
          ctx.strokeStyle = "white";
          ctx.globalAlpha = 0.85;
          ctx.lineWidth = specWidth;
          ctx.setLineDash([Math.max(10, glintLen - 6), L]);
          ctx.lineDashOffset = offsets[i] + 2; // slightly offset from the main glint
          drawSegment(s);
          ctx.stroke();
          ctx.restore();
        });
      }

      rafRef.current = requestAnimationFrame(drawFrame);
    };

    rafRef.current = requestAnimationFrame(drawFrame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [segments, baseWidth, specWidth, glintLen, tailLen, speedRange, colorStops, glow]);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 w-full h-full"
      style={{ zIndex: 0 }}
    />
  );
}