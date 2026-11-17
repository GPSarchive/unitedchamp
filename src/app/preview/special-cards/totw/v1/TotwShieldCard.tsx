// The «Ομάδα της Εβδομάδας» (Team of the Week) edition of the big player card.
//
// Same card as HoloShieldCard and the «Θρύλος» card — our shield, 5:7, photo
// filling the card, team logo top left, name and six numbers where they
// always are, team logo in the middle when there is no photo — in a different
// finish: DEEP RED ON BLACK.
//   · upper zone: faceted deep red, a lamp on its upper left and deep shade
//     on its right. With a photo the photo takes the zone (framed exactly as
//     on the normal card) and the facets keep only to its four corners, like
//     the corner mounts of a photo in an album — nothing of the finish lies
//     on the middle of the picture, where the face is;
//   · it ends in the black lower half: ONE plain black for the name and the
//     numbers — no band, no stripes, no lighter foot. Its lines are those of
//     the «Θρύλος» card, made quiet: one thin deep-red rule above and below
//     the name, a faint line under each row of numbers;
//   · thin deep-red rim with a dark line inside it.
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
  EMBER,
  FACETS,
  FACETS_MOUNT,
  FACETS_TILTED,
  HAIRLINE,
  ONYX,
  RING_RED,
  RULE,
  SNOW,
  TOTW_RIM,
  TotwFacetStyles,
} from "./totwFinish";

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

export default function TotwShieldCard({
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
      <TotwFacetStyles />
      <CardShadow glow="#A81017" />

      {/* Rim, then a dark line, then the face: each the shield, each a little further in. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: TOTW_RIM }} />
      <div aria-hidden className="absolute inset-[3px]" style={{ clipPath: SHIELD, background: "#160203" }} />

      <div
        className="absolute inset-[4px] overflow-hidden"
        style={{ clipPath: SHIELD, background: ONYX, color: SNOW }}
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

        {/* Soft light that follows the mouse. The black below covers it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background:
              "radial-gradient(circle, rgba(255,214,206,0.16) 0%, rgba(232,84,74,0.07) 32%, rgba(232,84,74,0) 58%)",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* The upper zone ends in black. Over a photo almost all of the fade is
            in the last few percent, so a face that sits low in the picture
            keeps its mouth and chin; over the facets it is only a shade. */}
        <div
          aria-hidden
          className={`absolute inset-x-0 ${hasPhoto ? "top-[47.5%] h-[8%]" : "top-[48.5%] h-[7%]"}`}
          style={{
            background: hasPhoto
              ? "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.1) 38%, rgba(10,10,10,0.5) 68%, rgba(10,10,10,0.92) 90%, #0A0A0A 100%)"
              : "linear-gradient(to bottom, rgba(10,0,1,0) 0%, rgba(10,0,1,0.34) 100%)",
          }}
        />

        {/* The lower half: one black, from under the name to the foot. */}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[55%]" style={{ background: ONYX }} />
        {/* The two rules round the name, as on the «Θρύλος» card — here one thin, quiet line each. */}
        <div aria-hidden className="absolute inset-x-0 top-[55%] h-px" style={{ background: RULE }} />
        <div aria-hidden className="absolute inset-x-0 top-[68.6%] h-px" style={{ background: RULE }} />

        {hasPhoto ? (
          // Team logo, top left, in a black medallion with a red ring.
          logo && (
            <div
              className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full"
              style={{
                background: ONYX,
                border: `2px solid ${RING_RED}`,
                boxShadow: "0 0 0 1px rgba(0,0,0,0.85), 0 3px 8px rgba(0,0,0,0.5)",
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
            style={logo ? { filter: "drop-shadow(0 6px 12px rgba(16,0,1,0.6))" } : undefined}
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
              <Silhouette color="#140102" opacity={0.5} />
            )}
          </div>
        )}

        {/* Name, where it always is. */}
        <div className="absolute inset-x-[8%] top-[55%] flex h-[13.6%] flex-col items-center justify-center text-center uppercase">
          <div className="w-full truncate text-[0.8rem] font-bold leading-none tracking-wide" style={{ color: EMBER }}>
            {first}
          </div>
          <div className="mt-1 w-full truncate text-[1.65rem] font-bold leading-none tracking-wide">
            {last || first || "—"}
          </div>
        </div>

        {/* The numbers, a faint line under each row. */}
        <div className="absolute inset-x-0 bottom-0 top-[71.2%]">
          {stats ? (
            <>
              <div aria-hidden className="absolute inset-x-0 top-[1.5rem] h-px" style={{ background: HAIRLINE }} />
              <CardStatGrid stats={stats} soft={EMBER} className="relative mx-[11%]" />
            </>
          ) : (
            <p className="relative mx-[10%] text-center text-[15px]" style={{ color: EMBER }}>
              Χωρίς στατιστικά ακόμα
            </p>
          )}
          <div aria-hidden className="absolute inset-x-0 top-[3.25rem] h-px" style={{ background: HAIRLINE }} />
        </div>
      </div>
    </div>
  );
}
