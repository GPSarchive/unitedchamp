// The «Θρύλος» (Legend) edition of the big player card, version 2: for
// honoured former players.
//
// The same card as HoloShieldCard — our shield, 5:7, team logo top left,
// name and six numbers where they always are, team logo in the middle when
// there is no photo — in the Legend finish. Where the normal card is black
// with light text, this one is LIGHT with dark text:
//   · upper zone: faceted pale gold, the whole width of the card;
//   · the photo is SET INTO the gold, in a window cut like a gem (peaked top,
//     two corners cut at 45°, a gold line around it). The gold stays in view
//     as the two top corners and down both sides whatever the photo is, and
//     the photo is whole inside its window: head, chin and collar, a little
//     smaller than on the normal card, with a sharp lower edge — nothing
//     fades over the face;
//   · an ivory plate below: the name between two gold rules, then the numbers
//     on faint ruled lines, shading to champagne at the point;
//   · thin deep-gold rim with a pale line inside it.
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
  FACETS_TILTED,
  GOLD_LINE,
  INK,
  IVORY,
  LEGEND_RIM,
  LegendFacetStyles,
  TIP,
} from "./legendFinish";

const FOLLOW = "var(--tilt-ms, 600ms) cubic-bezier(0.2, 0.8, 0.2, 1)";

// The photo's window, as a share of its own box: a peak that runs parallel to
// the card's top edge, two corners cut at 45°, straight sides, flat foot.
const WINDOW = "polygon(50% 0%, 71.5% 2.9%, 100% 35.2%, 100% 100%, 0% 100%, 0% 35.2%, 28.5% 2.9%)";
// Where that box sits on the face: 8% in from each side, down to the name band.
const WINDOW_BOX = "absolute inset-x-[8%] top-[3%] bottom-[44.5%]";

const HAIRLINE =
  "linear-gradient(90deg, rgba(96,84,48,0) 0%, rgba(96,84,48,0.2) 14%, rgba(96,84,48,0.2) 86%, rgba(96,84,48,0) 100%)";

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

  return (
    <div
      ref={tilt.ref}
      onPointerMove={tilt.onPointerMove}
      onPointerLeave={tilt.onPointerLeave}
      className="relative aspect-[5/7] w-full"
      style={TILT_STYLE}
    >
      <LegendFacetStyles />
      <CardShadow glow="#8E7E48" />

      {/* Rim, then a pale line, then the face: each the shield, each a little further in. */}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: LEGEND_RIM }} />
      <div aria-hidden className="absolute inset-[2px]" style={{ clipPath: SHIELD, background: "#FFFDF2" }} />

      <div
        className="absolute inset-[3.5px] overflow-hidden"
        style={{ clipPath: SHIELD, background: IVORY, color: INK }}
      >
        {/* Upper zone: the facets, as they are at rest (light from the upper left)… */}
        <div aria-hidden className={`absolute inset-x-0 top-0 h-[56%] ${FACETS}`} />
        {/* …and lit from the other side. Tilting the card fades this one in. */}
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 top-0 h-[56%] ${FACETS_TILTED}`}
          style={{
            opacity: "calc(var(--lit, 0) * (0.5 + var(--px, 0) * 0.5))",
            transition: `opacity ${FOLLOW}`,
            willChange: "opacity",
          }}
        />
        {/* The facets fade to ivory where they meet the plate. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[49%] h-[7%]"
          style={{
            background:
              "linear-gradient(to bottom, rgba(252,250,241,0) 0%, rgba(252,250,241,0.4) 50%, rgba(252,250,241,0.88) 86%, #FCFAF1 100%)",
          }}
        />

        {hasPhoto && (
          <>
            {/* The window's shadow on the gold: painted once, never moves on its own. */}
            <div
              aria-hidden
              className={`pointer-events-none ${WINDOW_BOX}`}
              style={{ filter: "blur(5px)", opacity: 0.42, transform: "translateY(2.5%) scale(1.015)" }}
            >
              <div className="h-full w-full" style={{ clipPath: WINDOW, background: "#5A4410" }} />
            </div>
            {/* Gold line, then the photo: the same cut, a little further in. */}
            <div className={WINDOW_BOX} style={{ clipPath: WINDOW, background: GOLD_LINE }}>
              <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: WINDOW, background: "#17150F" }}>
                {/* The photo covers a 5:6 box from the top of the window, and the window's
                    foot cuts it. An upright photo is framed as on the normal card; a wide
                    one, where the face is large and low, is seen from a little further
                    back, so the chin and the collar stay in the picture. */}
                <PlayerImage
                  src={photo}
                  alt={`${first} ${last}`.trim()}
                  width={640}
                  height={896}
                  className="absolute inset-x-0 top-0 aspect-[5/6] w-full object-cover object-top"
                  priority
                  animate={false}
                />
              </div>
            </div>
          </>
        )}

        {/* Soft light that follows the mouse. The plate below covers it. */}
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[130%]"
          style={{
            margin: "-65% 0 0 -65%",
            background:
              "radial-gradient(circle, rgba(255,255,255,0.24) 0%, rgba(255,252,235,0.08) 32%, rgba(255,252,235,0) 58%)",
            opacity: "var(--lit, 0)",
            transform: "translate3d(calc(var(--px, 0) * 38.5%), calc(var(--py, 0) * 53.8%), 0)",
            transition: `transform ${FOLLOW}, opacity 400ms ease`,
            willChange: "transform, opacity",
          }}
        />

        {/* The plate: ivory, cream toward the sides, champagne at the point. */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[55.5%]"
          style={{
            background:
              `linear-gradient(to bottom, rgba(230,222,192,0) 0%, rgba(230,222,192,0) 56%, ${TIP} 100%), ` +
              `linear-gradient(90deg, ${CREAM} 0%, ${IVORY} 16%, ${IVORY} 84%, ${CREAM} 100%)`,
          }}
        />
        {/* The two gold rules around the name, each with a pale line under it. */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-[55.5%] -mt-px h-[2px]"
          style={{ background: GOLD_LINE, boxShadow: "0 1px 0 rgba(255,255,255,0.9)" }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-[68.5%] -mt-px h-[2px]"
          style={{ background: GOLD_LINE, boxShadow: "0 1px 0 rgba(255,255,255,0.9)" }}
        />

        {hasPhoto ? (
          // Team logo, top left, as a medallion on the gold.
          logo && (
            <div
              className="absolute left-[9%] top-[10%] h-12 w-12 overflow-hidden rounded-full"
              style={{
                background: IVORY,
                border: "2px solid #C6A94F",
                boxShadow: "0 0 0 1px rgba(255,253,240,0.95), 0 3px 8px rgba(60,45,10,0.4)",
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
        <div className="absolute inset-x-[8%] top-[55.5%] flex h-[13%] flex-col items-center justify-center text-center uppercase">
          <div className="w-full truncate text-[0.8rem] font-bold leading-none tracking-wide" style={{ color: BRONZE }}>
            {first}
          </div>
          <div className="mt-1 w-full truncate text-[1.65rem] font-bold leading-none tracking-wide">
            {last || first || "—"}
          </div>
        </div>

        {/* The numbers, a faint line under each row, and the edition mark. */}
        <div className="absolute inset-x-0 bottom-0 top-[71%]">
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
          <div
            className="absolute inset-x-0 top-[4.05rem] pl-[0.3em] text-center text-[0.6rem] font-bold leading-none tracking-[0.3em]"
            style={{ color: BRONZE }}
          >
            ΘΡΥΛΟΣ
          </div>
        </div>
      </div>
    </div>
  );
}
