// The «Ήρωας» (Hero) edition of the big player card.
//
// The «Θρύλος» card (legend/v1/LegendShieldCard.tsx) in another finish: same
// shield, 5:7, photo filling the card, team logo top left, name and six
// numbers where they always are, team logo in the middle when there is no
// photo. Where the Legend card is light with dark text, this one is DEEP
// ROYAL PURPLE all over, with white and pale-lilac text:
//   · upper zone: faceted royal purple, lighter on the left and deep on the
//     right. With a photo the photo takes the zone (framed exactly as on the
//     normal card) and the facets keep only to its four corners, like the
//     corner mounts of a photo in an album — nothing of the finish lies on
//     the middle of the picture, where the face is;
//   · a band a shade lighter than everything above and below it, between two
//     faint lines of the same purple: the name;
//   · a purple satin plate with slanted folds: the numbers;
//   · a slightly lighter foot under a dark line, left empty for the edition title (to be decided);
//   · thin light-violet rim with a dark line inside it.
// Name and numbers sit on the band and the plate, never on the photo, so they
// read the same whatever the photo is.
//
// Cost, as for the normal card: every layer is painted once, the mouse only
// changes `transform` and `opacity` of ready-made layers, nothing runs while
// the card is idle. No blend modes, no filters on anything that moves. What
// the mouse does: tilt the card, fade the facets toward their other lighting,
// and move one soft light across the upper zone.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import type { DirectoryTeam, StatTuple } from "@/app/preview/paiktes-v2/model";
import { CardShadow, CardStatGrid, SHIELD, Silhouette } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { TILT_STYLE, useCardTilt } from "@/app/preview/paiktes-v2/[id]/useCardTilt";
import {
  BAND,
  DUSK,
  DUSK_RGB,
  FACETS,
  FACETS_MOUNT,
  FACETS_TILTED,
  HERO_RIM,
  HeroFacetStyles,
  LILAC,
  SATIN,
  SNOW,
  VIOLET,
} from "./heroFinish";

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

// Faint line above and below the name band: the band's own purple, a few
// shades lighter and brightest at its middle — a seam, not a stripe.
const RULE: React.CSSProperties = {
  background: "linear-gradient(90deg, #6A38BA 0%, #7A4ACB 24%, #8A5DD8 50%, #7A4ACB 76%, #6A38BA 100%)",
};

export default function HeroShieldCard({
  first,
  last,
  photo,
  team,
  stats,
  intro = true,
}: {
  first: string;
  last: string;
  photo: string | null;
  /** The team shown on the card, if any. */
  team: DirectoryTeam | null;
  /** The six numbers; null = none to show. */
  stats: StatTuple | null;
  /** Play the tilt sweep on mount (off when something else animates the card in). */
  intro?: boolean;
}) {
  const tilt = useCardTilt<HTMLDivElement>({ maxDeg: 12, direction: 1, intro });
  const hasPhoto = !isPlaceholderPhoto(photo);
  const logo = team != null && !isPlaceholderPhoto(team.logo) ? team.logo : null;
  const logoAlt = team ? `Σήμα ομάδας ${team.name}` : "";
  // With a photo, only the corner facets of the upper zone are kept.
  const mount = hasPhoto ? ` ${FACETS_MOUNT}` : "";

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative aspect-[5/7] w-full"
      style={TILT_STYLE}
    >
      <HeroFacetStyles />
      <CardShadow glow="#5B26B0" />

      {/* Rim, then a dark line, then the face: each the shield, each a little further in. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: HERO_RIM }} />
      <div aria-hidden className="absolute inset-[2.5px]" style={{ clipPath: SHIELD, background: "#1E0748" }} />

      <div
        className="absolute inset-[4px] overflow-hidden"
        style={{ clipPath: SHIELD, background: VIOLET, color: SNOW }}
      >
        {hasPhoto && (
          <PlayerImage
            src={photo}
            alt={`${first} ${last}`.trim()}
            width={640}
            height={896}
            className="absolute inset-0 h-full w-full object-cover object-top"
            priority
            animate={false}
          />
        )}

        {/* Upper zone: the facets, as they are at rest (light from the upper left)… */}
        <div aria-hidden className={`absolute inset-x-0 top-0 h-[55.5%] ${FACETS}${mount}`} />
        {/* …and lit from the other side. Tilting the card fades this one in. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-[55.5%] ${FACETS_TILTED}${mount}`}
          style={{
            opacity: "calc(var(--lit, 0) * (0.5 + var(--px, 0) * 0.5))",
            transition: `opacity ${FOLLOW}`,
            willChange: "opacity",
          }}
        />

        {/* Soft light that follows the mouse. The band and the plate below cover it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(240,230,255,0.09) 32%, rgba(240,230,255,0) 58%)",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* A photo sinks into purple just above the name band. Almost all of
            the fade is in the last few percent, so a face that sits low in the
            picture keeps its mouth and chin. Without a photo the facets run
            straight down to the band. */}
        {hasPhoto && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-[47.5%] h-[8%]"
            style={{
              background: `linear-gradient(to bottom, rgba(${DUSK_RGB},0) 0%, rgba(${DUSK_RGB},0.1) 38%, rgba(${DUSK_RGB},0.5) 68%, rgba(${DUSK_RGB},0.92) 90%, ${DUSK} 100%)`,
            }}
          />
        )}

        {/* The name band, then the satin plate for the numbers. */}
        <div aria-hidden className="absolute inset-x-0 top-[55%] h-[13.6%]" style={{ background: BAND }} />
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[68.6%]" style={{ background: SATIN }} />
        <div aria-hidden className="absolute inset-x-0 top-[55%] -mt-px h-[2px]" style={RULE} />
        <div aria-hidden className="absolute inset-x-0 top-[68.6%] -mt-px h-[2px]" style={RULE} />

        {hasPhoto ? (
          // Team logo, top left, in a light medallion.
          logo && (
            <div
              className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full"
              style={{
                background: "#F6F1FF",
                border: "2px solid #8F62E0",
                boxShadow: "0 0 0 1px rgba(20,4,56,0.85), 0 3px 8px rgba(10,2,30,0.5)",
              }}
            >
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
          // No photo: the team logo stands in the middle of the facets. A plain
          // outline only if the team has no logo.
          <div
            className="absolute inset-x-[23%] top-[11%] h-[41%]"
            style={logo ? { filter: "drop-shadow(0 6px 12px rgba(12,2,36,0.6))" } : undefined}
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
              <Silhouette color={LILAC} opacity={0.4} />
            )}
          </div>
        )}

        {/* Name, centred in its band. */}
        <div className="absolute inset-x-[8%] top-[55%] flex h-[13.6%] flex-col items-center justify-center text-center uppercase">
          <div className="w-full truncate text-[0.8rem] font-bold leading-none tracking-wide" style={{ color: LILAC }}>
            {first}
          </div>
          <div className="mt-1 w-full truncate text-[1.65rem] font-bold leading-none tracking-wide">
            {last || first || "—"}
          </div>
        </div>

        {/* The numbers on the plate, and the foot: the same satin, a little lighter, under a dark line. */}
        <div className="absolute inset-x-0 bottom-0 top-[71.2%]">
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 top-[3.25rem]"
            style={{ background: "rgba(255,255,255,0.09)", boxShadow: "inset 0 2px 0 rgba(20,4,56,0.55)" }}
          />
          {stats ? (
            <CardStatGrid stats={stats} soft={LILAC} className="relative mx-[11%]" />
          ) : (
            <p className="relative mx-[10%] text-center text-[15px]" style={{ color: LILAC }}>
              Χωρίς στατιστικά ακόμα
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
