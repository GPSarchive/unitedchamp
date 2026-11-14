// A player's profile, opened on top of the list. The card that was clicked in
// the row is thrown here: it lifts off, arcs across while turning once around
// its vertical axis, and lands a touch too big before settling. On landing a
// gold glow swells behind it, one streak of light crosses its face, and the
// profile assembles beside it piece by piece. Closing plays the flight
// backwards, quicker. The list stays behind a blurred, half-transparent veil
// with a soft spotlight where the card lands.
//
// Everything animated is `transform` / `opacity` through the Web Animations
// API, so the browser only moves layers it has already painted. The one
// exception is the light the card leaves behind in flight, which is painted
// on a small canvas for as long as the flight lasts (see `startTrail`).
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { ProfileStatLine } from "../paiktes-v2/data";
import type { DirectoryTeam, DirectoryTournament, PreparedPlayer } from "../paiktes-v2/model";
import { SHIELD } from "../paiktes-v2/[id]/cardShared";
import HoloShieldCard from "../paiktes-v2/[id]/HoloShieldCard";
import { LINK } from "../paiktes-v2/[id]/profileParts";
import type { PlayerExtra } from "./data";
import { NAME_LETTERING } from "./nameStyles";
import SeasonStats, { type TableLine } from "./SeasonStats";
import type { SeasonStanding } from "./standing";

const GOLD_RIM =
  "conic-gradient(from 124deg at 50% 50%, #D4AF37 0%, #FFC107 40%, #FFE08A 50%, #FFC107 60%, #D4AF37 100%)";

export const GOLD_TEXT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(170deg, #FFF9E6 0%, #FFE08A 15%, #D4AF37 30%, #B8941F 50%, #D4AF37 70%, #FFE08A 85%, #FFF9E6 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const PERSPECTIVE = "perspective(1400px)";

/** One pose of the flying card. Every pose lists the same functions, so the browser blends them one by one. */
const pose = (x: number, y: number, scale: number, roll: number, pitch: number, turn: number) =>
  `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${PERSPECTIVE} scale(${scale.toFixed(4)}) ` +
  `rotateZ(${roll.toFixed(2)}deg) rotateX(${pitch.toFixed(2)}deg) rotateY(${turn.toFixed(2)}deg)`;

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
/** Runs a little past 1 before settling on it. */
const easeOutBack = (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2);

const THROW_MS = 1050;

/**
 * The card's flight from the row (`from`) to its place (`home`), as if it
 * were picked up and thrown rather than slid:
 *   · it lifts off first (grows before it travels),
 *   · follows an arc that bows upward instead of a straight line,
 *   · turns once around its vertical axis, with a slight roll and pitch
 *     mid-air that are gone again by the time it lands,
 *   · arrives a touch too big and settles.
 * The eases live in the path itself, so the animation runs linear.
 */
type FlightPath = (t: number) => string;

function throwPath(from: DOMRect, home: DOMRect): FlightPath {
  const startScale = from.width / home.width;
  const dx = from.left + from.width / 2 - (home.left + home.width / 2);
  const dy = from.top + from.height / 2 - (home.top + home.height / 2);
  const lift = Math.min(170, 60 + Math.hypot(dx, dy) * 0.18);
  // Control point of the arc: a bit past half way, raised by `lift`.
  const cx = dx * 0.55;
  const cy = dy * 0.45 - lift;

  return (t) => {
    const along = easeInOutCubic(t);
    const x = (1 - along) * (1 - along) * dx + 2 * (1 - along) * along * cx;
    const y = (1 - along) * (1 - along) * dy + 2 * (1 - along) * along * cy;
    const scale = startScale + (1 - startScale) * easeOutBack(Math.pow(t, 1.6));
    const turn = 360 * easeInOutCubic(Math.min(1, t / 0.86));
    const air = Math.sin(Math.PI * t);
    return pose(x, y, scale, -9 * air * (1 - 0.4 * t), 11 * air, turn);
  };
}

/** The same flight played backwards (profile → row). */
const reversed = (path: FlightPath): FlightPath => (t) => path(1 - t);

/** A path as keyframes for the card. */
function bake(path: FlightPath, steps = 30): Keyframe[] {
  return Array.from({ length: steps + 1 }, (_, i) => ({ offset: i / steps, transform: path(i / steps) }));
}

// ── Light trail ─────────────────────────────────────────────────────────
// In flight the card bleeds light from its edges and leaves it hanging in
// the air behind it, cooling as it goes: white-hot → gold → orange → ember.
// A second colour, white with a touch of pink in the tail, is kept for later
// but not offered (see TRAIL_COLOUR). Visitors who ask their device for
// reduced motion get no flight, so no trail. It is a real trail, not a copy of the
// card: for every few milliseconds of the flight the card's true outline —
// turned, pitched and in perspective exactly as the card was at that moment
// — is laid down as light, so the ribbon narrows where the card was edge-on
// and widens where it faced us.
//
// What is on screen depends only on the flight's own clock, so the trail can
// never drift from the card, and a slow frame just means it catches up.

/** How long light hangs in the air behind the card. */
const TRAIL_MS = 380;
/** One outline of light is laid down per this many ms of flight. */
const TRAIL_STEP_MS = 6;
/** Painted at half size and blurred: it is light, not a drawing. */
const TRAIL_RES = 0.5;

type TrailColour = "gold" | "white";

/**
 * The trail's colour. Only gold is shown; the white one (with a pink tail)
 * is kept for later — set this to "white" to bring it back.
 */
const TRAIL_COLOUR: TrailColour = "gold";

/** SHIELD's corners, measured from the card's centre in card widths / heights. */
const SHIELD_CORNERS = [
  [50, 0],
  [88, 3.2],
  [100, 7.5],
  [100, 79],
  [50, 100],
  [0, 79],
  [0, 7.5],
  [12, 3.2],
].map(([x, y]) => [x / 100 - 0.5, y / 100 - 0.5] as const);

/** A ramp of 24 colours through `stops` ([age 0…1, r, g, b]): the light's colour as it ages. */
function ramp(stops: number[][]): string[] {
  return Array.from({ length: 24 }, (_, i) => {
    const age = i / 23;
    const hi = Math.max(1, stops.findIndex((s) => s[0] >= age));
    const [a0, ...from] = stops[hi - 1];
    const [a1, ...to] = stops[hi];
    const k = (age - a0) / (a1 - a0);
    return `rgb(${from.map((c, j) => Math.round(c + (to[j] - c) * k)).join(",")})`;
  });
}

const HEAT: Record<TrailColour, string[]> = {
  // white-hot → gold → orange → ember
  gold: ramp([
    [0, 255, 248, 230],
    [0.16, 255, 208, 92],
    [0.48, 251, 146, 60],
    [1, 176, 42, 8],
  ]),
  // pure white at the card, blushing pink as it cools: where the light is
  // dense it stays white, and the pink shows in the thin end of the tail
  white: ramp([
    [0, 255, 255, 255],
    [0.26, 255, 238, 247],
    [0.58, 255, 186, 222],
    [1, 204, 98, 172],
  ]),
};

/**
 * Paints the trail of `flight` (the card's animation along `path`) in the
 * colours of `heat` until the light has died away, and returns a function
 * that puts it out at once. With `leaving`, the light is spent by the time
 * the card lands, because the profile is taken down at that moment.
 */
function startTrail(
  canvas: HTMLCanvasElement,
  card: HTMLElement,
  flight: Animation,
  path: FlightPath,
  duration: number,
  leaving: boolean,
  heat: string[],
): () => void {
  const ctx = canvas.getContext("2d");
  const anchor = card.offsetParent;
  if (!ctx || !anchor) return () => {};

  canvas.style.display = "block";
  canvas.width = Math.ceil(canvas.clientWidth * TRAIL_RES);
  canvas.height = Math.ceil(canvas.clientHeight * TRAIL_RES);

  const w = card.offsetWidth;
  const h = card.offsetHeight;
  const tail = Math.min(TRAIL_MS, duration * 0.36);
  const count = Math.ceil(duration / TRAIL_STEP_MS);

  // The card's outline at every step of the flight, measured from where its
  // centre rests: the same transform the card flies, applied to its corners.
  const outlines: Float32Array[] = [];
  const speed = new Float32Array(count + 1);
  let fastest = 3; // px per step; a floor, so a short hop still glows
  for (let i = 0; i <= count; i++) {
    const m = new DOMMatrix(path(Math.min(1, (i * TRAIL_STEP_MS) / duration)));
    const at = (x: number, y: number) => {
      const depth = m.m14 * x + m.m24 * y + m.m44;
      return [(m.m11 * x + m.m21 * y + m.m41) / depth, (m.m12 * x + m.m22 * y + m.m42) / depth];
    };
    // [centre x, centre y, corner x, corner y, …]
    const points = new Float32Array(2 + SHIELD_CORNERS.length * 2);
    points.set(at(0, 0), 0);
    SHIELD_CORNERS.forEach(([x, y], k) => points.set(at(x * w, y * h), 2 + k * 2));
    outlines.push(points);
    if (i > 0) {
      // How far the corners travelled since the last step, turning included.
      const before = outlines[i - 1];
      let moved = 0;
      for (let k = 2; k < points.length; k += 2) moved += Math.hypot(points[k] - before[k], points[k + 1] - before[k + 1]);
      speed[i] = moved / SHIELD_CORNERS.length;
      fastest = Math.max(fastest, speed[i]);
    }
  }
  // Light is shed in proportion to speed: none while the card is still.
  for (let i = 0; i <= count; i++) speed[i] = Math.min(1, speed[i] / fastest);

  const ageAt = (i: number, now: number) => Math.max(0, Math.min(1, (now - i * TRAIL_STEP_MS) / tail)); // 0 just shed … 1 gone
  // The light draws in towards the path as it cools, so the tail tapers.
  const keepAt = (age: number) => 1 - 0.34 * age;

  const paint = (now: number) => {
    // Where the card rests right now, in the canvas's own space.
    const sheet = canvas.getBoundingClientRect();
    const frame = anchor.getBoundingClientRect();
    const ox = frame.left - sheet.left + card.offsetLeft + w / 2;
    const oy = frame.top - sheet.top + card.offsetTop + h / 2;
    const spent = leaving ? Math.max(0, Math.min(1, (duration - now) / (duration * 0.35))) : 1;

    ctx.setTransform(TRAIL_RES, 0, 0, TRAIL_RES, 0, 0);
    ctx.clearRect(0, 0, sheet.width, sheet.height);
    ctx.globalCompositeOperation = "lighter"; // light adds up: white-hot where it is densest
    ctx.lineCap = "butt";

    const first = Math.max(0, Math.ceil((now - tail) / TRAIL_STEP_MS));
    const last = Math.min(count, Math.floor(now / TRAIL_STEP_MS));
    for (let i = first; i <= last; i++) {
      const age = ageAt(i, now);
      const fade = (1 - age) * spent;
      const strength = speed[i] * fade;
      if (strength < 0.008) continue;
      const points = outlines[i];
      const keep = keepAt(age);
      ctx.fillStyle = ctx.strokeStyle = heat[Math.round(age * (heat.length - 1))];

      // A faint body of light: everywhere the card's face has just been.
      ctx.beginPath();
      for (let k = 2; k < points.length; k += 2) {
        const x = ox + points[0] + (points[k] - points[0]) * keep;
        const y = oy + points[1] + (points[k + 1] - points[1]) * keep;
        if (k === 2) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.globalAlpha = 0.05 * strength * fade;
      ctx.fill();

      // The streaks: the line each corner draws through the air from this
      // step to the next. Joined end to end they are unbroken however fast
      // the card moves, and they start at the card's own edges.
      if (i === last) continue;
      const next = outlines[i + 1];
      const keepNext = keepAt(ageAt(i + 1, now));
      ctx.beginPath();
      for (let k = 2; k < points.length; k += 2) {
        ctx.moveTo(ox + points[0] + (points[k] - points[0]) * keep, oy + points[1] + (points[k + 1] - points[1]) * keep);
        ctx.lineTo(
          ox + next[0] + (next[k] - next[0]) * keepNext,
          oy + next[1] + (next[k + 1] - next[1]) * keepNext,
        );
      }
      const glow = Math.pow(speed[i], 0.6) * fade;
      ctx.lineWidth = 11; // halo
      ctx.globalAlpha = 0.2 * glow;
      ctx.stroke();
      ctx.lineWidth = 3; // core
      ctx.globalAlpha = 0.95 * glow;
      ctx.stroke();
    }
  };

  let raf = 0;
  let stopped = false;
  let landedAt = 0;
  let painted = -1;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = "";
  };
  const tick = () => {
    if (stopped) return;
    // The flight's clock while it flies; the wall clock once it has landed,
    // for the last of the light to drain away.
    let now: number;
    const at = flight.currentTime;
    if (at == null || flight.playState === "finished") {
      landedAt ||= performance.now();
      now = duration + (performance.now() - landedAt);
    } else {
      now = Number(at);
    }
    if (now >= duration + tail) {
      stop();
      return;
    }
    if (now !== painted) {
      painted = now;
      paint(now);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  return stop;
}

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** What shows while the card is turned away during the spin. */
function CardBack() {
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0" style={{ clipPath: SHIELD, background: GOLD_RIM }} />
      <div
        className="absolute inset-[2px] flex items-center justify-center overflow-hidden"
        style={{
          clipPath: SHIELD,
          background:
            "repeating-linear-gradient(-45deg, rgba(212,175,55,0.16) 0 2px, transparent 2px 14px), " +
            "radial-gradient(circle at 50% 40%, rgba(212,175,55,0.3) 0%, transparent 62%), #0b0b0d",
        }}
      >
        <div className="text-center text-3xl font-bold italic uppercase leading-[0.95] tracking-tight" style={GOLD_TEXT}>
          Ultra
          <br />
          Champ
        </div>
      </div>
    </div>
  );
}

export default function ProfileOverlay({
  entry,
  teams,
  extra,
  tournaments,
  seasonLabel,
  standing,
  teamLines,
  origin,
  closing,
  onRequestClose,
  onExited,
}: {
  entry: PreparedPlayer;
  /** The player's active-season teams, main team first. */
  teams: DirectoryTeam[];
  extra: PlayerExtra | null;
  /** Where the player ranks this season among everyone in the list. */
  standing: SeasonStanding | null;
  /** This season split by team, most matches first. */
  teamLines: TableLine[];
  tournaments: DirectoryTournament[];
  seasonLabel: string | null;
  /** Where the row's card was when it was clicked; null when opened by link. */
  origin: DOMRect | null;
  /** Set by the parent to play the way out; `onExited` fires when it is done. */
  closing: boolean;
  onRequestClose: () => void;
  onExited: () => void;
}) {
  const { player } = entry;
  const letters = NAME_LETTERING;
  // When the card has landed and the profile has assembled: nothing in the
  // stats should start moving before then.
  const [settleAt] = useState(() => performance.now() + (origin ? THROW_MS * 0.8 : 380) + 320);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const veilRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const spotRef = useRef<HTMLDivElement | null>(null);
  const bloomRef = useRef<HTMLDivElement | null>(null);
  const glintRef = useRef<HTMLDivElement | null>(null);
  const trailRef = useRef<HTMLCanvasElement | null>(null);

  // One trail at a time: starting a flight puts out the previous one's light.
  const stopTrailRef = useRef<(() => void) | null>(null);
  const beginTrail = (flight: Animation, path: FlightPath, duration: number, leaving: boolean) => {
    stopTrailRef.current?.();
    const canvas = trailRef.current;
    const card = cardRef.current;
    stopTrailRef.current =
      canvas && card ? startTrail(canvas, card, flight, path, duration, leaving, HEAT[TRAIL_COLOUR]) : null;
  };
  useEffect(() => () => stopTrailRef.current?.(), []);


  // ── Way in ────────────────────────────────────────────────────────────
  useLayoutEffect(() => {
    const card = cardRef.current;
    const veil = veilRef.current;
    const content = contentRef.current;
    if (!card || !veil || !content) return;
    const calm = prefersReducedMotion();
    const running: Animation[] = [];

    running.push(veil.animate([{ opacity: 0 }, { opacity: 1 }], { duration: calm ? 120 : 420, easing: "ease-out" }));

    if (calm) {
      // Reduced motion: everything simply fades in.
      running.push(content.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 }));
      running.push(card.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 120 }));
      return () => running.forEach((a) => a.cancel());
    }

    const home = card.getBoundingClientRect();

    // A soft spotlight on the spot the card is heading for; the rest of the
    // veil falls a little darker towards the edges.
    const spot = spotRef.current;
    if (spot) {
      const x = home.left + home.width / 2;
      const y = home.top + home.height / 2;
      spot.style.background =
        `radial-gradient(circle at ${x.toFixed(0)}px ${y.toFixed(0)}px, rgba(255,214,102,0.14) 0px, ` +
        `rgba(255,214,102,0.05) 230px, rgba(0,0,0,0) 430px, rgba(0,0,0,0.4) 100%)`;
    }

    // When the card arrives (`landing` ms from now)…
    let landing: number;
    if (origin) {
      const path = throwPath(origin, home);
      const flight = card.animate(bake(path), { duration: THROW_MS, easing: "linear" });
      running.push(flight);
      landing = THROW_MS * 0.8;
      // The light it leaves behind. (Read from storage here: this runs before
      // the button's state is set.)
      beginTrail(flight, path, THROW_MS, false);
    } else {
      // Opened from a link: no row to come from, so it just turns to face us.
      running.push(
        card.animate(
          [
            { opacity: 0, transform: pose(0, 0, 0.84, 0, 0, -85) },
            { opacity: 1, transform: pose(0, 0, 1.04, 0, 0, 0), offset: 0.75 },
            { opacity: 1, transform: pose(0, 0, 1, 0, 0, 0) },
          ],
          { duration: 620, easing: "cubic-bezier(0.22, 0.9, 0.24, 1)" },
        ),
      );
      landing = 380;
    }

    // …a gold glow swells behind it once and fades away,
    const bloom = bloomRef.current;
    if (bloom) {
      running.push(
        bloom.animate(
          [
            { opacity: 0, transform: "scale(0.55)" },
            { opacity: 1, transform: "scale(1)", offset: 0.32 },
            { opacity: 0, transform: "scale(1.22)" },
          ],
          { duration: 950, delay: landing - 180, easing: "ease-out" },
        ),
      );
    }

    // …one streak of light runs across its face,
    const glint = glintRef.current;
    if (glint) {
      running.push(
        glint.animate(
          [
            { opacity: 0, transform: "translateX(-140%) skewX(-18deg)" },
            { opacity: 1, transform: "translateX(-90%) skewX(-18deg)", offset: 0.12 },
            { opacity: 1, transform: "translateX(270%) skewX(-18deg)", offset: 0.88 },
            { opacity: 0, transform: "translateX(320%) skewX(-18deg)" },
          ],
          { duration: 720, delay: landing + 120, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
        ),
      );
    }

    // …and the profile assembles next to it, piece by piece, the name first:
    // it is wiped in from the left while the rest rise into place.
    const reveal = Math.max(0, landing - 220);
    const nameEl = content.querySelector<HTMLElement>("[data-name-letters]");
    if (nameEl) {
      running.push(
        nameEl.animate(
          [{ clipPath: "inset(-30% 100% -30% -4%)" }, { clipPath: "inset(-30% -4% -30% -4%)" }],
          { duration: 560, delay: reveal, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" },
        ),
      );
    }
    Array.from(content.children).forEach((part, i) => {
      running.push(
        part.animate(
          [
            { opacity: 0, transform: "translateY(18px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          { duration: 480, delay: reveal + i * 80, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)", fill: "backwards" },
        ),
      );
    });

    return () => running.forEach((a) => a.cancel());
    // Runs once per opened profile (the parent keys this component by player).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Way out ───────────────────────────────────────────────────────────
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  useEffect(() => {
    if (!closing) return;
    const card = cardRef.current;
    const veil = veilRef.current;
    const content = contentRef.current;
    if (!card || !veil || !content) {
      onExitedRef.current();
      return;
    }
    const calm = prefersReducedMotion();
    // The way out is the way in played backwards, and quicker: leaving should
    // not be a show.
    const duration = calm ? 120 : 620;
    veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration, easing: "ease-in", fill: "forwards" });
    content.animate([{ opacity: 1 }, { opacity: 0 }], { duration: calm ? 100 : 180, fill: "forwards" });

    // Back to the row it came from, if that row is still on the page.
    const rowCard = document.querySelector<HTMLElement>(`[data-card-id="${player.id}"]`);
    const target = rowCard?.getBoundingClientRect();
    const onScreen = target != null && target.bottom > 0 && target.top < window.innerHeight;
    const wayBack =
      !calm && target && onScreen ? reversed(throwPath(target, card.getBoundingClientRect())) : null;
    const flight = wayBack
      ? card.animate(bake(wayBack), { duration, easing: "linear", fill: "forwards" })
      : card.animate(
          [
            { opacity: 1, transform: "scale(1)" },
            { opacity: 0, transform: calm ? "scale(1)" : "scale(0.9)" },
          ],
          { duration: calm ? 120 : 260, easing: "ease-in", fill: "forwards" },
        );
    if (wayBack) beginTrail(flight, wayBack, duration, true);
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      onExitedRef.current();
    };
    flight.finished.then(finish, finish);
    // Safety net: never leave a dead veil over the page.
    const timer = window.setTimeout(finish, duration + 200);
    return () => window.clearTimeout(timer);
  }, [closing, player.id]);

  // ── Dialog behaviour: scroll lock, Escape, focus stays inside ─────────
  useEffect(() => {
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus({ preventScroll: true });
    return () => {
      document.documentElement.style.overflow = previousOverflow;
    };
  }, []);

  const requestCloseRef = useRef(onRequestClose);
  requestCloseRef.current = onRequestClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const root = rootRef.current;
      if (!root) return;
      const focusable = root.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !root.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !root.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const facts = [
    player.position || null,
    extra?.age != null ? `${extra.age} ετών` : null,
    extra?.heightCm ? `${extra.heightCm} εκ.` : null,
  ].filter((x): x is string => x !== null);

  const tournamentLines: ProfileStatLine[] = tournaments.flatMap((t) => {
    const stats = player.byTournament[t.id];
    return stats ? [{ key: `t-${t.id}`, label: t.name, href: `/tournaments/${t.id}`, stats }] : [];
  });
  const historyLines: ProfileStatLine[] = (extra?.history ?? []).map((line) => ({
    key: `s-${line.season}`,
    label: line.label,
    href: line.href,
    stats: line.stats,
  }));

  const closeOnSelf = (e: React.MouseEvent<HTMLElement>) => {
    if (e.target === e.currentTarget) onRequestClose();
  };

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-overlay-name"
      className="fixed inset-0 z-[70] text-[#F3EFE6]"
    >
      {/* The veil: the list stays visible, blurred, underneath. */}
      <div
        ref={veilRef}
        aria-hidden
        className="absolute inset-0 bg-[#07070d]/75 backdrop-blur-md"
      >
        <div ref={spotRef} className="absolute inset-0" />
      </div>

      {/* The light the card leaves behind in flight: over the veil, under the
          card. Shown only while a trail is being painted (see startTrail). */}
      <canvas
        ref={trailRef}
        aria-hidden
        className="pointer-events-none absolute inset-0 hidden h-full w-full"
        style={{ filter: "blur(4px)" }}
      />

      <div className="absolute inset-0 overflow-y-auto overflow-x-hidden overscroll-contain" onClick={closeOnSelf}>
        <div className="mx-auto max-w-5xl px-4 pb-16 pt-16 md:px-6 md:pt-20" onClick={closeOnSelf}>
          <div className="grid gap-8 md:grid-cols-[minmax(0,20rem)_minmax(0,1fr)] md:gap-10" onClick={closeOnSelf}>
            {/* The card. `preserve-3d` + hidden back faces give the spin a
                real back side instead of a mirrored front. */}
            <div className="relative mx-auto w-full max-w-[20rem] md:mx-0">
              {/* Glow that swells once behind the card as it lands. */}
              <div
                ref={bloomRef}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[180%] opacity-0"
                style={{
                  margin: "-90% 0 0 -90%",
                  background:
                    "radial-gradient(circle, rgba(255,214,102,0.5) 0%, rgba(255,193,7,0.2) 30%, rgba(255,193,7,0) 62%)",
                }}
              />
              <div
                ref={cardRef}
                className="relative"
                style={{ transformStyle: "preserve-3d", willChange: "transform" }}
              >
                <div className="relative" style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}>
                  <HoloShieldCard
                    first={player.first}
                    last={player.last}
                    photo={player.photo}
                    team={teams[0] ?? null}
                    stats={player.season}
                    intro={false}
                  />
                  {/* One streak of light across the face on landing. */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 overflow-hidden"
                    style={{ clipPath: SHIELD }}
                  >
                    <div
                      ref={glintRef}
                      className="absolute -top-1/4 left-0 h-[150%] w-[38%] opacity-0"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,250,230,0.5) 50%, rgba(255,255,255,0) 100%)",
                        transform: "translateX(-140%) skewX(-18deg)",
                      }}
                    />
                  </div>
                </div>
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                    transform: "rotateY(180deg)",
                  }}
                >
                  <CardBack />
                </div>
              </div>
            </div>

            <div ref={contentRef} className="min-w-0">
              <h2 id="profile-overlay-name" className="uppercase">
                {player.last && player.first ? (
                  <span className="block text-lg leading-none tracking-[0.08em] text-[#F3EFE6]/75">
                    {player.first}
                  </span>
                ) : null}
                <span data-name-letters className={`mt-2 block pr-2 leading-[1.05] ${letters.title}`} style={letters.style}>
                  {player.last || player.first || "—"}
                </span>
              </h2>
              {facts.length > 0 && <p className="mt-3 text-lg text-[#F3EFE6]/80">{facts.join(" · ")}</p>}

              {teams.length > 0 ? (
                <ul className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
                  {teams.map((team) => (
                    <li key={team.id}>
                      <Link href={`/OMADA/${team.id}`} className={`inline-flex items-center gap-3 ${LINK}`}>
                        <span className="h-9 w-9 shrink-0 overflow-hidden border border-[#F3EFE6]/15 bg-[#13131d]">
                          {!isPlaceholderPhoto(team.logo) && (
                            <PlayerImage
                              src={team.logo}
                              alt=""
                              width={36}
                              height={36}
                              className="h-full w-full object-contain p-0.5"
                              animate={false}
                            />
                          )}
                        </span>
                        <span className="text-lg">{team.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-5 text-[15px] text-[#F3EFE6]/65">Δεν ανήκει σε ομάδα την τρέχουσα σεζόν.</p>
              )}

              <div className="mt-4">
                <SeasonStats
                  seasonLabel={seasonLabel}
                  season={player.season}
                  standing={standing}
                  teams={teamLines}
                  tournaments={tournamentLines}
                  history={historyLines}
                  settleAt={settleAt}
                />
              </div>
            </div>
          </div>
        </div>
      </div>


      <button
        ref={closeRef}
        type="button"
        onClick={onRequestClose}
        aria-label="Κλείσιμο προφίλ"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center border border-[#F3EFE6]/25 bg-[#0a0a14]/80 text-[#F3EFE6] hover:border-[#fb923c] hover:text-[#fb923c] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#fb923c] md:right-6 md:top-6"
      >
        <svg aria-hidden viewBox="0 0 10 10" className="h-3.5 w-3.5">
          <path d="M1 1l8 8M9 1l-8 8" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
    </div>
  );
}
