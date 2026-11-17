// The «Επαγγελματίας» (Pro Player) edition of the big player card.
//
// Same card as the «Θρύλος» card (version 1) — our shield, 5:7, photo filling
// the card, team logo top left, name and six numbers where they always are,
// team logo in the middle when there is no photo — in a different finish.
// Where «Θρύλος» is pale gold over ivory, this one is TEAL all the way down,
// with teal-black text:
//   · upper zone: faceted teal, light on the left and deep on the right. With
//     a photo the photo takes the zone (framed exactly as on the normal card)
//     and the facets keep only to its four corners, like the corner mounts of
//     a photo in an album — nothing of the finish lies on the middle of the
//     picture, where the face is;
//   · a lighter aqua band for the name, between two bright mint lines;
//   · a flat mid-teal plate for the numbers, crossed by a slanted sheen;
//   · a bright mint foot left empty for the edition title (to be decided);
//   · thin blue-teal rim with a mint line inside it.
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
  BAND_EDGE,
  DEEP,
  FACETS,
  FACETS_MOUNT,
  FACETS_TILTED,
  FOOT,
  FOOT_LINE,
  FOOT_SHEEN,
  INK,
  PLATE,
  PRO_RIM,
  ProFacetStyles,
  RULE_MINT,
  SHEEN,
  SOFT,
  TITLE,
} from "./proFinish";

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

// Bright mint line, brightest in the middle.
const RULE: React.CSSProperties = {
  background: `linear-gradient(90deg, #47D8C2 0%, ${RULE_MINT} 30%, #6CF5E1 50%, ${RULE_MINT} 70%, #47D8C2 100%)`,
};

// Where the foot starts, measured in the box that holds plate and foot (it
// starts at 68.6% of the card): 3.25rem under the top of the numbers.
const FOOT_TOP = "calc(8.28% + 3.25rem)";

export default function ProShieldCard({
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
      <ProFacetStyles />
      <CardShadow glow="#13AA9A" />

      {/* Rim, then a mint line, then the face: each the shield, each a little further in. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: PRO_RIM }} />
      <div aria-hidden className="absolute inset-[2.5px]" style={{ clipPath: SHIELD, background: RULE_MINT }} />

      <div
        className="absolute inset-[4px] overflow-hidden"
        style={{ clipPath: SHIELD, background: PLATE, color: INK }}
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

        {/* Soft light that follows the mouse. The plate below covers it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background:
              "radial-gradient(circle, rgba(220,255,248,0.24) 0%, rgba(150,255,236,0.09) 32%, rgba(150,255,236,0) 58%)",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* Under a photo the upper zone sinks into deep teal at its bottom.
            Almost all of the fade is in the last few percent, so a face that
            sits low in the picture keeps its mouth and chin. Without a photo
            the facets run down to the band untouched. */}
        {hasPhoto && (
          <div
            aria-hidden
            className="absolute inset-x-0 top-[47.5%] h-[8%]"
            style={{
              background: `linear-gradient(to bottom, rgba(8,149,127,0) 0%, rgba(8,149,127,0.1) 38%, rgba(8,149,127,0.5) 68%, rgba(8,149,127,0.92) 90%, ${DEEP} 100%)`,
            }}
          />
        )}

        {/* The name band, then plate and foot in one box so the sheen runs through both. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[55%] h-[13.6%]"
          style={{
            background: `linear-gradient(90deg, ${BAND_EDGE} 0%, #41D2BC 28%, ${BAND} 50%, #41D2BC 72%, ${BAND_EDGE} 100%)`,
          }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[68.6%]" style={{ background: SHEEN }} />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[68.6%]"
          style={{ background: `${FOOT_SHEEN}, ${FOOT}`, clipPath: `inset(${FOOT_TOP} 0 0 0)` }}
        >
          <div aria-hidden className="absolute inset-x-0 h-[2px]" style={{ top: FOOT_TOP, background: FOOT_LINE }} />
        </div>
        <div aria-hidden className="absolute inset-x-0 top-[55%] -mt-px h-[2px]" style={RULE} />
        <div aria-hidden className="absolute inset-x-0 top-[68.6%] -mt-px h-[2px]" style={RULE} />

        {hasPhoto ? (
          // Team logo, top left, in a light medallion.
          logo && (
            <div
              className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full"
              style={{
                background: "#F4FFFC",
                border: "2px solid #26BDAB",
                boxShadow: "0 0 0 1px rgba(94,239,217,0.9), 0 3px 8px rgba(1,40,34,0.45)",
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
            style={logo ? { filter: "drop-shadow(0 5px 10px rgba(1,46,39,0.5))" } : undefined}
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
              <Silhouette color={INK} opacity={0.4} />
            )}
          </div>
        )}

        {/* Name, centred in its band. */}
        <div className="absolute inset-x-[8%] top-[55%] flex h-[13.6%] flex-col items-center justify-center text-center uppercase">
          <div className="w-full truncate text-[0.8rem] font-bold leading-none tracking-wide" style={{ color: SOFT }}>
            {first}
          </div>
          <div className="mt-1 w-full truncate text-[1.65rem] font-bold leading-none tracking-wide">
            {last || first || "—"}
          </div>
        </div>

        {/* The numbers. */}
        <div className="absolute inset-x-0 bottom-0 top-[71.2%]">
          {stats ? (
            <CardStatGrid stats={stats} soft={SOFT} className="relative mx-[11%]" />
          ) : (
            <p className="relative mx-[10%] text-center text-[15px]" style={{ color: SOFT }}>
              Χωρίς στατιστικά ακόμα
            </p>
          )}
          {/* The edition's title, in the foot. */}
          <div
            className="absolute inset-x-0 text-center font-bold uppercase leading-none"
            style={{ top: "4.4rem", color: SOFT, fontSize: "0.8rem", letterSpacing: "0.32em", paddingLeft: "0.32em" }}
          >
            {TITLE}
          </div>
        </div>
      </div>
    </div>
  );
}
