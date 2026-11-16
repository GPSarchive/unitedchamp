// The «Ομάδα της Χρονιάς» card as it sits in a list row: MiniCard in the
// Team-of-the-Year finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo with four blue faceted corners (or the
// team logo on blue facets) on top, then the black satin band and the striped
// plate, inside a silver rim. The black half is empty here, as MiniCard
// carries no text. The silver rim, the blue corners and the band are what
// tell this card from the normal black one at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import {
  BAND,
  FACETS_MINI,
  FACETS_MINI_CORNERS,
  FOOT_VEIL,
  PLATE,
  STRIPES,
  TOTY_RIM_FLAT,
  TotyFacetStyles,
} from "./totyFinish";

// One layer over the lower part of the card (it starts at 57% of the height).
// Three pictures, top one first:
//   · down the layer: the upper zone sinking into black, nothing over the
//     band except the shade at its lower edge, nothing over the plate, the
//     lighter foot;
//   · the band (from 15% to 37% of the layer);
//   · the striped plate (from 37% down).
const LOWER =
  "linear-gradient(to bottom, " +
  "rgba(2,4,7,0) 0%, rgba(2,4,7,0.85) 12%, #020407 15%, " +
  "rgba(0,0,0,0) 15%, rgba(0,0,0,0) 31%, rgba(0,0,0,0.7) 37%, " +
  `rgba(0,0,0,0) 37%, rgba(0,0,0,0) 66%, ${FOOT_VEIL} 66%, ${FOOT_VEIL} 100%), ` +
  `${BAND} 0 19.23% / 100% 22% no-repeat, ` +
  `${STRIPES} 0 100% / 100% 63% no-repeat`;

// Photo cards only: the same lower layer with the black turned to deep blue —
// the fade, the band and the striped plate all keep their shapes.
const BLUE_DEEP = "#04143A";
const BLUE_STRIPE = "#0A2558";
const BLUE_BAND =
  "linear-gradient(90deg, #020C24 0%, #061A44 13%, #0C2A63 26%, #133B80 39%, #17448F 50%, #133B80 61%, #0C2A63 74%, #061A44 87%, #020C24 100%)";
const BLUE_STRIPES =
  `linear-gradient(57deg, ${BLUE_DEEP} 0%, ${BLUE_DEEP} 9%, ${BLUE_STRIPE} 12%, ${BLUE_STRIPE} 20%, ${BLUE_DEEP} 23%, ${BLUE_DEEP} 32.5%, ` +
  `${BLUE_STRIPE} 35.5%, ${BLUE_STRIPE} 43.5%, ${BLUE_DEEP} 46.5%, ${BLUE_DEEP} 55.5%, ${BLUE_STRIPE} 58.5%, ${BLUE_STRIPE} 100%)`;
const LOWER_BLUE =
  "linear-gradient(to bottom, " +
  `rgba(4,20,58,0) 0%, rgba(4,20,58,0.85) 12%, ${BLUE_DEEP} 15%, ` +
  "rgba(0,0,0,0) 15%, rgba(0,0,0,0) 31%, rgba(0,4,20,0.55) 37%, " +
  `rgba(0,0,0,0) 37%, rgba(0,0,0,0) 66%, ${FOOT_VEIL} 66%, ${FOOT_VEIL} 100%), ` +
  `${BLUE_BAND} 0 19.23% / 100% 22% no-repeat, ` +
  `${BLUE_STRIPES} 0 100% / 100% 63% no-repeat`;

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
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[57%]" style={{ background: hasPhoto ? LOWER_BLUE : LOWER }} />
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
