// The player's card on the player page. Two designs exist while this is a
// preview, both shield-shaped and both tilting in 3D:
//   · the flat card (name and six numbers under the player), in four finishes,
//   · the holographic card — the original 3D card in the new shape.
// A switch under the card compares them; the choice is remembered.
//
// On both: a player's photo, when there is one, fills the whole card. Without
// a photo the team logo takes the player's place, centred above the numbers.
"use client";

import { useEffect, useState } from "react";
import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { CardTier } from "../data";
import type { DirectoryTeam, StatTuple } from "../model";
import { CardShadow, CardStatGrid, SHIELD, Silhouette } from "./cardShared";
import HoloShieldCard from "./HoloShieldCard";
import { TILT_STYLE, useCardTilt } from "./useCardTilt";

type FlatStyle = "gold" | "tier" | "team" | "dark";
type CardStyle = FlatStyle | "holo";

const FLAT_OPTIONS: { value: FlatStyle; label: string; hint: string }[] = [
  { value: "gold", label: "Χρυσή", hint: "Ίδιο χρυσό φινίρισμα για όλους." },
  { value: "tier", label: "Βαθμίδες", hint: "Χρυσό, ασημένιο ή χάλκινο ανάλογα με τη σεζόν του παίκτη." },
  { value: "team", label: "Ομάδα", hint: "Στο χρώμα της ομάδας." },
  { value: "dark", label: "Σκούρα", hint: "Σκούρα με πορτοκαλί, όπως το υπόλοιπο site." },
];
const HOLO_HINT = "Η αρχική 3D κάρτα (χρυσό, ολογραφική λάμψη) στο νέο σχήμα.";

const ALL_STYLES: CardStyle[] = ["gold", "tier", "team", "dark", "holo"];
const STYLE_KEY = "paiktes-v2:card-style";

type Paint = {
  /** The card's surface without a photo; its rim when a photo fills the card. */
  background: string;
  /** Text colours on the plain surface. */
  ink: string;
  soft: string;
  rule: string;
  /** Light tone of the same finish, for small text over a photo. */
  accent: string;
  sheen: boolean;
};

const METAL: Record<CardTier, Paint> = {
  gold: {
    background:
      "linear-gradient(135deg, #b8860b 0%, #f5e08a 28%, #d4a017 52%, #f7e7a0 74%, #a87708 100%)",
    ink: "#2a1c00",
    soft: "rgba(42,28,0,0.62)",
    rule: "rgba(42,28,0,0.35)",
    accent: "#F5E08A",
    sheen: true,
  },
  silver: {
    background:
      "linear-gradient(135deg, #8d9096 0%, #f2f3f5 28%, #b9bcc2 52%, #fafafa 74%, #85888e 100%)",
    ink: "#1d1f24",
    soft: "rgba(29,31,36,0.6)",
    rule: "rgba(29,31,36,0.3)",
    accent: "#E6E8EC",
    sheen: true,
  },
  bronze: {
    background:
      "linear-gradient(135deg, #8a5a33 0%, #e9bd93 28%, #b97d4d 52%, #f0cba6 74%, #7d4f2b 100%)",
    ink: "#2b1707",
    soft: "rgba(43,23,7,0.62)",
    rule: "rgba(43,23,7,0.32)",
    accent: "#EDC49C",
    sheen: true,
  },
};

const DARK: Paint = {
  background: "linear-gradient(160deg, #1c1c2a 0%, #101019 55%, #0a0a14 100%)",
  ink: "#F3EFE6",
  soft: "rgba(243,239,230,0.62)",
  rule: "rgba(251,146,60,0.7)",
  accent: "#fb923c",
  sheen: false,
};

// Rim of the dark finish over a photo: the plain dark surface would vanish.
const DARK_RIM = "linear-gradient(160deg, #fb923c 0%, #7c3f12 55%, #fb923c 100%)";

const EMPTY: Paint = {
  background: "linear-gradient(160deg, #2c2c2f 0%, #1d1d20 60%, #18181a 100%)",
  ink: "#F3EFE6",
  soft: "rgba(243,239,230,0.6)",
  rule: "rgba(243,239,230,0.25)",
  accent: "rgba(243,239,230,0.75)",
  sheen: false,
};
const EMPTY_RIM = "linear-gradient(160deg, #8a8a90 0%, #3a3a3f 55%, #8a8a90 100%)";

function paintFor(style: FlatStyle, tier: CardTier | null, teamColour: string | null): Paint {
  if (style === "gold") return METAL.gold;
  if (style === "tier") return METAL[tier ?? "bronze"];
  if (style === "team" && teamColour) {
    return {
      background: `linear-gradient(160deg, ${teamColour} 0%, color-mix(in srgb, ${teamColour} 45%, #0a0a14) 55%, #0a0a14 100%)`,
      ink: "#ffffff",
      soft: "rgba(255,255,255,0.72)",
      rule: "rgba(255,255,255,0.45)",
      accent: `color-mix(in srgb, ${teamColour} 50%, #ffffff)`,
      sheen: false,
    };
  }
  return DARK;
}

/** What frames the photo: the finish itself, except where that is near-black. */
function rimFor(paint: Paint, teamColour: string | null): string {
  if (paint === DARK) return DARK_RIM;
  if (paint === EMPTY) return EMPTY_RIM;
  if (!paint.sheen && teamColour) {
    return `linear-gradient(160deg, ${teamColour} 0%, color-mix(in srgb, ${teamColour} 55%, #ffffff) 50%, ${teamColour} 100%)`;
  }
  return paint.background;
}

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

function FlatShieldCard({
  first,
  last,
  photo,
  team,
  teamColour,
  stats,
  paint,
}: {
  first: string;
  last: string;
  photo: string | null;
  team: DirectoryTeam | null;
  teamColour: string | null;
  stats: StatTuple | null;
  paint: Paint;
}) {
  const tilt = useCardTilt<HTMLDivElement>({ maxDeg: 11, direction: -1, intro: true });
  const hasPhoto = !isPlaceholderPhoto(photo);
  const logo = team != null && !isPlaceholderPhoto(team.logo) ? team.logo : null;
  const logoAlt = team ? `Σήμα ομάδας ${team.name}` : "";

  // With a photo, the photo IS the card: it fills the whole shield, the finish
  // becomes a rim around it, and the text sits on a dark scrim in light inks.
  // Without one, the card shows its plain finish and the team logo takes the
  // player's place.
  const ink = hasPhoto ? "#ffffff" : paint.ink;
  const soft = hasPhoto ? paint.accent : paint.soft;

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative aspect-[5/7] w-full"
      style={TILT_STYLE}
    >
      <CardShadow />

      {/* The finish: the whole surface, or just the rim once a photo covers it. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ clipPath: SHIELD, background: hasPhoto ? rimFor(paint, teamColour) : paint.background }}
      />

      <div
        className={`absolute overflow-hidden ${hasPhoto ? "inset-[3px] bg-[#0b0b0d]" : "inset-0"}`}
        style={{ clipPath: SHIELD, color: ink }}
      >
        {hasPhoto ? (
          <>
            <PlayerImage
              src={photo}
              alt={`${first} ${last}`.trim()}
              width={640}
              height={896}
              className="absolute inset-0 h-full w-full object-cover object-top"
              priority
              animate={false}
            />
            {/* Scrim so the logo, name and numbers read on any photo. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 20%, rgba(0,0,0,0) 44%, rgba(0,0,0,0.78) 59%, rgba(0,0,0,0.93) 100%)",
              }}
            />
            {/* Team logo, top left — nothing else in this corner. */}
            {logo && (
              <div
                className="absolute left-[9%] top-[11%] h-[13%] w-[18%]"
                style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.85))" }}
              >
                <PlayerImage
                  src={logo}
                  alt={logoAlt}
                  width={96}
                  height={96}
                  className="h-full w-full object-contain"
                  animate={false}
                />
              </div>
            )}
          </>
        ) : (
          <>
            {paint.sheen && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.38) 46%, transparent 60%)",
                  mixBlendMode: "soft-light",
                }}
              />
            )}
            {/* No photo: the team logo stands in front, centred — and not in
                the corner. A plain outline only if the team has no logo. */}
            <div
              className="absolute inset-x-[23%] top-[11%] h-[41%]"
              style={logo ? { filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.35))" } : undefined}
            >
              {logo ? (
                <PlayerImage
                  src={logo}
                  alt={logoAlt}
                  width={320}
                  height={320}
                  className="h-full w-full object-contain"
                  priority
                  animate={false}
                />
              ) : (
                <Silhouette color={paint.ink} />
              )}
            </div>
          </>
        )}

        {/* Name */}
        <div className="absolute inset-x-[8%] top-[56%] text-center">
          <div className="truncate text-[0.8rem] uppercase leading-none" style={{ color: soft }}>
            {first}
          </div>
          <div className="mt-1 truncate text-[1.65rem] font-bold uppercase leading-none tracking-tight">
            {last || first || "—"}
          </div>
          <div
            aria-hidden
            className="mx-auto mt-2 h-px w-2/3"
            style={hasPhoto ? { background: paint.accent, opacity: 0.55 } : { background: paint.rule }}
          />
        </div>

        {/* Highlight that follows the mouse: a ready-made disc that is only
            moved and faded, never redrawn. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.14) 30%, rgba(255,255,255,0) 56%)",
            mixBlendMode: "overlay",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {stats ? (
          <CardStatGrid stats={stats} soft={soft} className="absolute inset-x-[11%] top-[69.5%]" />
        ) : (
          <p className="absolute inset-x-[10%] top-[70%] text-center text-[15px]" style={{ color: soft }}>
            Χωρίς στατιστικά ακόμα
          </p>
        )}
      </div>
    </div>
  );
}

export default function PlayerCard({
  first,
  last,
  photo,
  teams,
  teamColour,
  stats,
  tier,
}: {
  first: string;
  last: string;
  photo: string | null;
  /** Active-season teams, main team first. */
  teams: DirectoryTeam[];
  teamColour: string | null;
  /** Active-season numbers; null = no appearances yet. */
  stats: StatTuple | null;
  tier: CardTier | null;
}) {
  const [style, setStyle] = useState<CardStyle>("gold");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STYLE_KEY);
      if (saved && (ALL_STYLES as string[]).includes(saved)) setStyle(saved as CardStyle);
    } catch {
      // Storage unavailable: the default style is fine.
    }
  }, []);

  const choose = (next: CardStyle) => {
    setStyle(next);
    try {
      localStorage.setItem(STYLE_KEY, next);
    } catch {
      // Not remembered, still applied.
    }
  };

  const hint =
    style === "holo"
      ? HOLO_HINT
      : !stats
        ? "Χωρίς συμμετοχές η κάρτα μένει γκρι σε όλα τα χρώματα."
        : style === "team" && !teamColour
          ? "Η ομάδα δεν έχει ορισμένο χρώμα, εμφανίζεται η σκούρα."
          : FLAT_OPTIONS.find((o) => o.value === style)?.hint;

  const optionClass = (active: boolean) =>
    `h-10 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#fb923c] ${
      active ? "bg-[#fb923c] font-bold text-[#0a0a14]" : "text-[#F3EFE6]/80 hover:bg-[#F3EFE6]/[0.06]"
    }`;

  return (
    <div>
      {style === "holo" ? (
        <HoloShieldCard first={first} last={last} photo={photo} team={teams[0] ?? null} stats={stats} />
      ) : (
        <FlatShieldCard
          // Remount per finish so the intro sweep shows the new one.
          key={style}
          first={first}
          last={last}
          photo={photo}
          team={teams[0] ?? null}
          teamColour={teamColour}
          stats={stats}
          paint={stats ? paintFor(style, tier, teamColour) : EMPTY}
        />
      )}

      {/* Preview only: compare the designs. Remove once one is chosen. */}
      <fieldset className="mt-5">
        <legend className="text-[13px] text-[#F3EFE6]/65">Στιλ κάρτας (προεπισκόπηση)</legend>
        <div className="mt-1.5 border border-[#F3EFE6]/20">
          <div className="grid grid-cols-4">
            {FLAT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => choose(option.value)}
                aria-pressed={style === option.value}
                className={optionClass(style === option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => choose("holo")}
            aria-pressed={style === "holo"}
            className={`w-full border-t border-[#F3EFE6]/20 ${optionClass(style === "holo")}`}
          >
            Ολογραφική 3D
          </button>
        </div>
        <p className="mt-1.5 text-[13px] text-[#F3EFE6]/60">{hint}</p>
      </fieldset>
    </div>
  );
}
