// The «Θρύλος» (Legend) edition of the big player card: for former players.
//
// Same card as HoloShieldCard — our shield, 5:7, photo filling the card, team
// logo top left, name and six numbers where they always are, team logo in the
// middle when there is no photo — in a different finish. Where the normal
// card is black with light text, this one is LIGHT with dark text:
//   · upper zone: faceted pale gold. With a photo the photo takes the zone
//     (framed exactly as on the normal card) and the facets keep only to its
//     four corners, like the corner mounts of a photo in an album — nothing
//     of the finish lies on the middle of the picture, where the face is;
//   · it fades to white at the bottom, into
//   · an ivory plate: the name between two gold rules, then the numbers on
//     faint ruled lines, then a pearl foot left empty for the edition title (to be decided);
//   · thin deep-gold rim with a white line inside it.
// Name and numbers sit on the plate, never on the photo, so they read the
// same whatever the photo is.
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
  BRONZE,
  CREAM,
  FACETS,
  FACETS_MOUNT,
  FACETS_TILTED,
  INK,
  IVORY,
  LEGEND_RIM,
  LegendFacetStyles,
  PEARL,
} from "./legendFinish";

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

// Satin gold line with a white line above and below it.
const RULE: React.CSSProperties = {
  background: "linear-gradient(90deg, #CFB462 0%, #DECD97 22%, #CAAD5C 48%, #DBC98D 72%, #CDB360 100%)",
  boxShadow: "0 1px 0 #fff, 0 -1px 0 #fff",
};

const HAIRLINE =
  "linear-gradient(90deg, rgba(96,84,48,0) 0%, rgba(96,84,48,0.16) 14%, rgba(96,84,48,0.16) 86%, rgba(96,84,48,0) 100%)";

export default function LegendShieldCard({
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
      <LegendFacetStyles />
      <CardShadow glow="#A8985C" />

      {/* Rim, then a white line, then the face: each the shield, each a little further in. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: LEGEND_RIM }} />
      <div aria-hidden className="absolute inset-[2.5px]" style={{ clipPath: SHIELD, background: "#fff" }} />

      <div
        className="absolute inset-[4px] overflow-hidden"
        style={{ clipPath: SHIELD, background: IVORY, color: INK }}
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
              "radial-gradient(circle, rgba(255,255,255,0.22) 0%, rgba(255,252,235,0.08) 32%, rgba(255,252,235,0) 58%)",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* The upper zone fades to white at its bottom. Over a photo almost all
            of the fade is in the last few percent, so a face that sits low in
            the picture keeps its mouth and chin. */}
        <div
          aria-hidden
          className={`absolute inset-x-0 ${hasPhoto ? "top-[47.5%] h-[8%]" : "top-[46%] h-[9.5%]"}`}
          style={{
            background: hasPhoto
              ? "linear-gradient(to bottom, rgba(254,254,251,0) 0%, rgba(254,254,251,0.1) 38%, rgba(254,254,251,0.5) 68%, rgba(254,254,251,0.92) 90%, #FEFEFB 100%)"
              : "linear-gradient(to bottom, rgba(254,254,251,0) 0%, rgba(254,254,251,0.45) 50%, rgba(254,254,251,0.9) 84%, #FEFEFB 100%)",
          }}
        />

        {/* The plate: name band, then the numbers' zone with its cream edges. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[55%] h-[13.6%]"
          style={{ background: "linear-gradient(to bottom, #F8F5EA 0%, #FEFEFD 46%, #FEFEFD 54%, #F8F5EA 100%)" }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[68.6%]"
          style={{ background: `linear-gradient(90deg, ${CREAM} 0%, ${IVORY} 10%, ${IVORY} 90%, ${CREAM} 100%)` }}
        />
        <div aria-hidden className="absolute inset-x-0 top-[55%] -mt-px h-[2px]" style={RULE} />
        <div aria-hidden className="absolute inset-x-0 top-[68.6%] -mt-px h-[2px]" style={RULE} />

        {hasPhoto ? (
          // Team logo, top left, in a light medallion.
          logo && (
            <div
              className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full"
              style={{
                background: IVORY,
                border: "2px solid #CDB360",
                boxShadow: "0 0 0 1px rgba(255,255,255,0.9), 0 3px 8px rgba(60,45,10,0.35)",
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
            style={logo ? { filter: "drop-shadow(0 5px 10px rgba(74,56,12,0.45))" } : undefined}
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
              <Silhouette color={BRONZE} opacity={0.4} />
            )}
          </div>
        )}

        {/* Name, centred in its band. */}
        <div className="absolute inset-x-[8%] top-[55%] flex h-[13.6%] flex-col items-center justify-center text-center uppercase">
          <div className="w-full truncate text-[0.8rem] font-bold leading-none tracking-wide" style={{ color: BRONZE }}>
            {first}
          </div>
          <div className="mt-1 w-full truncate text-[1.65rem] font-bold leading-none tracking-wide">
            {last || first || "—"}
          </div>
        </div>

        {/* The numbers, a faint line under each row, and the foot. */}
        <div className="absolute inset-x-0 bottom-0 top-[71.2%]">
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 top-[3.25rem]"
            style={{ background: `linear-gradient(to bottom, ${PEARL} 0%, ${IVORY} 46%, ${IVORY} 100%)` }}
          />
          {stats ? (
            <>
              <div aria-hidden className="absolute inset-x-0 top-[1.5rem] h-px" style={{ background: HAIRLINE }} />
              <CardStatGrid stats={stats} soft={BRONZE} className="relative mx-[11%]" />
            </>
          ) : (
            <p className="relative mx-[10%] text-center text-[15px]" style={{ color: BRONZE }}>
              Χωρίς στατιστικά ακόμα
            </p>
          )}
          <div aria-hidden className="absolute inset-x-0 top-[3.25rem] h-px" style={{ background: HAIRLINE }} />
        </div>
      </div>
    </div>
  );
}
