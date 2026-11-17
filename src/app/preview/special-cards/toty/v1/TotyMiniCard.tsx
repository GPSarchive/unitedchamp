// The «Ομάδα της Χρονιάς» card as it sits in a list row: MiniCard in the
// Team-of-the-Year finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo with four small blue faceted corners
// (or the team logo on blue facets) on top, sinking into the plain black
// lower half, inside a silver rim. The black is empty here, as MiniCard
// carries no text. The silver rim, the blue corners and the black half are
// what tell this card from the normal black one at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { FACETS_MINI, FACETS_MINI_CORNERS, PLATE, RULE, TOTY_RIM_FLAT, TotyFacetStyles } from "./totyFinish";

// One layer over the lower part of the card (it starts at 57% of the height):
// the upper zone sinks into the black, then the two rules round the (empty)
// name band — at 15% and 37% of the layer, as on the «Θρύλος» mini — on
// plain black.
const LOWER =
  "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 12%, " +
  `${PLATE} 15%, ${RULE} 15%, ${RULE} calc(15% + 1px), ${PLATE} calc(15% + 1px), ` +
  `${PLATE} 37%, ${RULE} 37%, ${RULE} calc(37% + 1px), ${PLATE} calc(37% + 1px), ${PLATE} 100%)`;

export default function TotyMiniCard({
  photo,
  logo,
  initial,
}: {
  photo: string | null;
  /** Team logo, shown when there is no photo. */
  logo: string | null;
  /** Shown when there is neither. */
  initial: string;
}) {
  const hasPhoto = !isPlaceholderPhoto(photo);
  const hasLogo = !isPlaceholderPhoto(logo);
  return (
    <div className="relative aspect-[5/7] w-full">
      <TotyFacetStyles mini />
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: TOTY_RIM_FLAT }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: PLATE }}>
        {hasPhoto ? (
          <>
            <PlayerImage
              src={photo}
              alt=""
              width={112}
              height={157}
              className="absolute inset-0 h-full w-full object-cover object-top"
              animate={false}
            />
            <div aria-hidden className={`absolute inset-x-0 top-0 h-[63.5%] ${FACETS_MINI_CORNERS}`} />
          </>
        ) : (
          <div aria-hidden className={`absolute inset-x-0 top-0 h-[64%] ${FACETS_MINI}`} />
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[57%]" style={{ background: LOWER }} />
        {hasPhoto ? null : hasLogo ? (
          <div className="absolute inset-x-[19%] top-[10%] h-[48%]">
            <PlayerImage
              src={logo}
              alt=""
              width={80}
              height={80}
              className="h-full w-full object-contain"
              animate={false}
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="absolute inset-x-0 top-[16%] text-center text-2xl font-bold"
            style={{ color: "#CFE6FB", opacity: 0.9 }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
