// The original 3D holographic card (src/app/paiktes/ProfileCard) in the shield
// shape, with the SAME LAYOUT as the flat cards (see PlayerCard.tsx):
//   · photo fills the card, team logo top left, name and six numbers below;
//   · no photo → the team logo stands in the middle instead, not in the corner.
// What stays its own is the styling: gold rim and glow, faceted onyx surface,
// metallic gold name, logo in a gold ring, and holographic streaks plus a warm
// highlight that follow the mouse.
//
// The surface (onyxFinish.tsx): the black is cut into facets like obsidian.
// Without a photo (most players) the team logo stands large in the middle of
// it and tilting the card moves the light across the facets. With a photo the
// photo fills the card and the facets are only the surface under it. On the
// facets the two mouse effects are turned down (streaks to about half, the
// highlight to two thirds) — there the facets show the light themselves, and
// gold streaks at full strength over lit facets look dirty.
//
// It is also cheap to run: every layer is painted ONCE. The original redrew
// its gradients, filters and box-shadow on each mouse move (nine CSS variables
// fed into backgrounds) and kept three animations running forever; here the
// mouse only changes `transform` and `opacity` of ready-made layers, and
// nothing runs while the card is idle. No canvas pass, no animated SVG, no
// per-frame filters, one blend mode instead of six. The facets are a CSS
// background, not elements; the mouse fades in one more copy of them, lit
// from the other side.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { DirectoryTeam, StatTuple } from "../model";
import { CardShadow, CardStatGrid, SHIELD, Silhouette } from "./cardShared";
import { FACETS, FACETS_TILTED, OnyxFacetStyles } from "./onyxFinish";
import { TILT_STYLE, useCardTilt } from "./useCardTilt";

const GOLD_RIM =
  "conic-gradient(from 124deg at 50% 50%, #D4AF37 0%, #FFC107 40%, #FFE08A 50%, #FFC107 60%, #D4AF37 100%)";

/** The highlight under the mouse: full over a photo (or a flat `surface`), softer on the facets. */
const HIGHLIGHT_FULL =
  "radial-gradient(circle, rgba(255,244,214,0.34) 0%, rgba(255,224,138,0.1) 32%, rgba(255,224,138,0) 58%)";
const HIGHLIGHT_ON_FACETS =
  "radial-gradient(circle, rgba(255,244,214,0.22) 0%, rgba(255,224,138,0.07) 32%, rgba(255,224,138,0) 58%)";

// Thin bright-gold diagonal streaks on near-black. Under `color-dodge` the
// black leaves the picture untouched and the streaks light it up, which is the
// holographic sheen of the original. Colours are baked in (no CSS filter).
const HOLO_STREAKS =
  "repeating-linear-gradient(-45deg, #0f0b00 0%, #5c4d1d 5.7%, #d2ad3d 6.75%, #5c4d1d 7.8%, #0f0b00 15%, #0f0b00 18%), " +
  "repeating-linear-gradient(62deg, rgba(255,224,138,0) 0%, rgba(255,224,138,0.22) 9%, rgba(255,224,138,0) 18%)";

const GOLD_TEXT: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(170deg, #FFF9E6 0%, #FFE08A 15%, #D4AF37 30%, #B8941F 50%, #D4AF37 70%, #FFE08A 85%, #FFF9E6 100%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

const GOLD_SOFT = "rgba(255,224,138,0.85)";
const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

export default function HoloShieldCard({
  first,
  last,
  photo,
  team,
  stats,
  intro = true,
  surface,
}: {
  first: string;
  last: string;
  photo: string | null;
  /** Main active-season team, if any. */
  team: DirectoryTeam | null;
  /** Active-season numbers; null = no appearances yet. */
  stats: StatTuple | null;
  /** Play the tilt sweep on mount (off when something else animates the card in). */
  intro?: boolean;
  /** A flat CSS background instead of the faceted onyx — only to compare with the old look. */
  surface?: string;
}) {
  const tilt = useCardTilt<HTMLDivElement>({ maxDeg: 12, direction: 1, intro });
  const hasPhoto = !isPlaceholderPhoto(photo);
  const faceted = surface == null;
  /** The facets are what you see: no photo covers them. */
  const onFacets = faceted && !hasPhoto;
  const logo = team != null && !isPlaceholderPhoto(team.logo) ? team.logo : null;
  const logoAlt = team ? `Σήμα ομάδας ${team.name}` : "";

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative aspect-[5/7] w-full"
      style={TILT_STYLE}
    >
      {faceted && <OnyxFacetStyles />}
      <CardShadow glow="#D4AF37" />

      {/* Gold rim: the full shield, with the face inset 2px on top of it. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: GOLD_RIM }} />

      {/* The face. Its background is the facets as they are at rest (light from the upper left). */}
      <div
        className={`absolute inset-[2px] overflow-hidden text-white ${faceted ? FACETS : ""}`}
        style={{ clipPath: SHIELD, background: surface }}
      >
        {onFacets && (
          // The same facets lit from the upper right. Tilting the card fades this one in.
          <div
            aria-hidden
            className={`pointer-events-none absolute inset-0 ${FACETS_TILTED}`}
            style={{
              opacity: "calc(var(--lit, 0) * (0.5 + var(--px, 0) * 0.5))",
              transition: `opacity ${FOLLOW}`,
              willChange: "opacity",
            }}
          />
        )}
        {hasPhoto && (
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
          </>
        )}

        {/* Holographic streaks: twice the card's size, slid under the mouse. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-1/2"
          style={{
            backgroundImage: HOLO_STREAKS,
            mixBlendMode: "color-dodge",
            opacity: onFacets ? "calc(0.06 + var(--lit, 0) * 0.3)" : "calc(0.14 + var(--lit, 0) * 0.5)",
            transform: "translate3d(calc(var(--px, 0) * -14%), calc(var(--py, 0) * -14%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {hasPhoto ? (
          // Team logo, top left, in the card's gold ring — nothing else here.
          logo && (
            <div className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full border-2 border-[#FFC107] bg-black/70">
              <PlayerImage
                src={logo}
                alt={logoAlt}
                width={96}
                height={96}
                className="h-full w-full object-cover"
                animate={false}
              />
            </div>
          )
        ) : (
          // No photo: the team logo stands in front, centred — and not in the
          // corner. A plain outline only if the team has no logo.
          <div
            className="absolute inset-x-[23%] top-[11%] h-[41%]"
            style={logo ? { filter: "drop-shadow(0 6px 12px rgba(0,0,0,0.6))" } : undefined}
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
              <Silhouette color="#D4AF37" opacity={0.35} />
            )}
          </div>
        )}

        {/* Highlight that follows the mouse. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background: onFacets ? HIGHLIGHT_ON_FACETS : HIGHLIGHT_FULL,
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* Name, in the original's metallic gold. */}
        <div className="absolute inset-x-[8%] top-[56%] text-center uppercase">
          <div style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.9))" }}>
            <div className="truncate text-[0.8rem] font-bold leading-none tracking-wide" style={GOLD_TEXT}>
              {first}
            </div>
            <div className="mt-1 truncate text-[1.65rem] font-bold leading-none tracking-wide" style={GOLD_TEXT}>
              {last || first || "—"}
            </div>
          </div>
          <div aria-hidden className="mx-auto mt-2 h-px w-2/3" style={{ background: "rgba(212,175,55,0.55)" }} />
        </div>

        {stats ? (
          <CardStatGrid stats={stats} soft={GOLD_SOFT} className="absolute inset-x-[11%] top-[69.5%]" />
        ) : (
          <p className="absolute inset-x-[10%] top-[70%] text-center text-[15px]" style={{ color: GOLD_SOFT }}>
            Χωρίς στατιστικά ακόμα
          </p>
        )}
      </div>
    </div>
  );
}
