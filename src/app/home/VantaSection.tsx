"use client";

// Topology background — the Vanta.js TOPOLOGY effect (after Kjetil Midtgarden
// Golid's p5ycho sketch), rewritten on a plain 2D canvas.
//
// Why not Vanta itself:
// - It needed p5 (~1 MB) + vanta from a CDN as two separate scripts. vanta reads
//   `window.p5` once when its own script runs, so when it arrived before p5 the
//   effect silently failed and the section stayed flat orange.
// - `lazyOnload` only fetched them after the whole page (hero photos included)
//   had loaded.
// - Every frame it drew 4500 separate lines and allocated thousands of vectors,
//   at full device pixel ratio, forever, even off-screen.
//
// Here: no scripts, typed arrays, lines stroked in batches, pixel ratio capped,
// paused off-screen, and drawing stops once the picture has built up (the canvas
// keeps it).

import React, { useEffect, useRef } from "react";

type Props = React.PropsWithChildren<{
  className?: string;
  color?: number;
  backgroundColor?: number;
  overlayClassName?: string; // optional darkening scrim for contrast, e.g. "bg-black/20"
  /** Simulation steps before drawing stops (~60 per second). */
  steps?: number;
  maxDpr?: number;
}>;

const OFFSET = 100;
const CELL = 10;
const NOISE_SIZE = 0.003;
const NOISE_RADIUS = 0.1;
const ANGLES = 48;
const SPEED = 2.2;
// Same density the old effect had in this section on desktop (4500 particles
// over ~1640×510 px), so phones get proportionally fewer.
const DENSITY = 4500 / (1640 * 510);
const MAX_PARTICLES = 6000;
const BATCH = 300; // particles per stroke(); overlaps between batches still add up
const STEP_MS = 1000 / 60 - 2; // don't run faster than ~60 steps/s on 120 Hz screens

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const rgba = (n: number, a: number) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 4-octave value noise with cosine blending, in [0, ~0.94] — the same kind,
 * range and falloff as p5's noise(), which the effect was tuned for.
 */
function makeNoise(rand: () => number) {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) vals[i] = rand();

  const lattice = (ix: number, iy: number) => vals[perm[perm[ix & 255] + (iy & 255)]];
  const blend = (t: number) => 0.5 * (1 - Math.cos(t * Math.PI));
  const value = (x: number, y: number) => {
    const X = Math.floor(x), Y = Math.floor(y);
    const u = blend(x - X), v = blend(y - Y);
    const a = lattice(X, Y), b = lattice(X + 1, Y);
    const c = lattice(X, Y + 1), d = lattice(X + 1, Y + 1);
    const top = a + u * (b - a);
    const bottom = c + u * (d - c);
    return top + v * (bottom - top);
  };
  return (x: number, y: number) => {
    let sum = 0, amp = 0.5, f = 1;
    for (let o = 0; o < 4; o++) {
      sum += amp * value(x * f, y * f);
      amp *= 0.5;
      f *= 2;
    }
    return sum;
  };
}

type Sim = { pause(): void; resume(): void; stop(): void };

function startTopology(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  opts: { color: number; steps: number; maxDpr: number; fast: boolean },
): Sim {
  const ctx = canvas.getContext("2d");
  if (!ctx || width < 2 || height < 2) return { pause() {}, resume() {}, stop() {} };

  const dpr = Math.min(window.devicePixelRatio || 1, opts.maxDpr);
  canvas.width = Math.round(width * dpr); // also clears the canvas
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(opts.color, 0.05);

  const rand = mulberry32(1337);
  const noise = makeNoise(rand);

  const PW = width + OFFSET * 2;
  const PH = height + OFFSET * 2;
  const gw = Math.ceil(PW / CELL) + 1;
  const gh = Math.ceil(PH / CELL) + 1;

  // Flow field, computed lazily per cell on first visit.
  const fx = new Float32Array(gw * gh);
  const fy = new Float32Array(gw * gh);
  const ready = new Uint8Array(gw * gh);
  const cosR = new Float32Array(ANGLES);
  const sinR = new Float32Array(ANGLES);
  for (let k = 0; k < ANGLES; k++) {
    cosR[k] = Math.cos((k / ANGLES) * Math.PI * 2) * NOISE_RADIUS;
    sinR[k] = Math.sin((k / ANGLES) * Math.PI * 2) * NOISE_RADIUS;
  }
  const computeFlow = (idx: number, j: number, i: number) => {
    const x = j * NOISE_SIZE, y = i * NOISE_SIZE;
    let hi = -1, lo = 2, hx = 0, hy = 0, lx = 0, ly = 0;
    for (let k = 0; k < ANGLES; k++) {
      const px = x + cosR[k], py = y + sinR[k];
      const v = noise(px, py);
      if (v > hi) { hi = v; hx = px; hy = py; }
      if (v < lo) { lo = v; lx = px; ly = py; }
    }
    const dx = lx - hx, dy = ly - hy;
    const len = Math.hypot(dx, dy);
    const s = len > 0 ? (hi - lo) / len : 0;
    fx[idx] = dx * s;
    fy[idx] = dy * s;
    ready[idx] = 1;
  };

  const n = Math.min(MAX_PARTICLES, Math.round(PW * PH * DENSITY));
  const posX = new Float32Array(n), posY = new Float32Array(n);
  const prevX = new Float32Array(n), prevY = new Float32Array(n);
  const velX = new Float32Array(n), velY = new Float32Array(n);
  const accX = new Float32Array(n), accY = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    posX[k] = prevX[k] = rand() * PW;
    posY[k] = prevY[k] = rand() * PH;
  }

  const step = () => {
    for (let k = 0; k < n; k++) {
      // Flow under the particle before it moves (same order as the original sketch).
      const cj = Math.min(gw - 1, Math.floor(Math.min(Math.max(posX[k], 0), PW) / CELL));
      const ci = Math.min(gh - 1, Math.floor(Math.min(Math.max(posY[k], 0), PH) / CELL));
      const idx = ci * gw + cj;
      if (!ready[idx]) computeFlow(idx, cj, ci);

      prevX[k] = posX[k];
      prevY[k] = posY[k];
      posX[k] = (((posX[k] + velX[k]) % PW) + PW) % PW;
      posY[k] = (((posY[k] + velY[k]) % PH) + PH) % PH;

      let vx = velX[k] + accX[k];
      let vy = velY[k] + accY[k];
      const vl = Math.hypot(vx, vy);
      if (vl > 0) {
        vx = (vx / vl) * SPEED;
        vy = (vy / vl) * SPEED;
      }
      velX[k] = vx;
      velY[k] = vy;
      accX[k] = fx[idx] * 3;
      accY[k] = fy[idx] * 3;
    }
    for (let start = 0; start < n; start += BATCH) {
      const end = Math.min(n, start + BATCH);
      ctx.beginPath();
      for (let k = start; k < end; k++) {
        const dx = posX[k] - prevX[k], dy = posY[k] - prevY[k];
        if (dx * dx + dy * dy < 100) {
          ctx.moveTo(prevX[k] - OFFSET, prevY[k] - OFFSET);
          ctx.lineTo(posX[k] - OFFSET, posY[k] - OFFSET);
        }
      }
      ctx.stroke();
    }
  };

  let done = 0;
  let raf = 0;
  let last = 0;
  let running = false;
  const perFrame = opts.fast ? 30 : 1;

  const frame = (t: number) => {
    raf = 0;
    if (!running) return;
    if (opts.fast || t - last >= STEP_MS) {
      last = t;
      for (let s = 0; s < perFrame && done < opts.steps; s++, done++) step();
    }
    if (done < opts.steps) raf = requestAnimationFrame(frame);
    else running = false;
  };

  const pause = () => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  return {
    resume() {
      if (running || done >= opts.steps) return;
      running = true;
      raf = requestAnimationFrame(frame);
    },
    pause,
    stop() {
      pause();
      done = opts.steps;
    },
  };
}

export default function VantaSection({
  className = "",
  color = 0x9f371b,
  backgroundColor = 0xf4c253,
  overlayClassName, // e.g. "bg-black/30"
  steps = 600,
  maxDpr = 1.5,
  children,
}: Props) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const canvas = canvasRef.current;
    if (!section || !canvas) return;

    const fast = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let visible = false;
    let size = { w: 0, h: 0 };
    let sim: Sim | null = null;
    let resizeTimer: ReturnType<typeof setTimeout> | undefined;

    const restart = () => {
      sim?.stop();
      size = { w: section.clientWidth, h: section.clientHeight };
      sim = startTopology(canvas, size.w, size.h, { color, steps, maxDpr, fast });
      if (visible) sim.resume();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) sim?.resume();
        else sim?.pause();
      },
      { rootMargin: "100px" },
    );

    // Fires once on observe (first start), then only on real size changes.
    const ro = new ResizeObserver(() => {
      const w = section.clientWidth;
      const h = section.clientHeight;
      if (Math.abs(w - size.w) < 2 && Math.abs(h - size.h) < 2) return;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(restart, sim ? 200 : 0);
    });

    io.observe(section);
    ro.observe(section);

    return () => {
      clearTimeout(resizeTimer);
      io.disconnect();
      ro.disconnect();
      sim?.stop();
    };
  }, [color, steps, maxDpr]);

  return (
    <section
      ref={sectionRef}
      className={`relative overflow-hidden ${className}`}
      style={{ backgroundColor: hex(backgroundColor) }}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 h-full w-full"
      />

      {overlayClassName ? <div className={`absolute inset-0 z-10 ${overlayClassName}`} /> : null}

      <div className="relative z-20">{children}</div>
    </section>
  );
}
