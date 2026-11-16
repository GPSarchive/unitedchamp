// The «Ομάδα της Εβδομάδας» card as it sits in a list row: MiniCard in the
// Team-of-the-Week finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on red facets) on
// top, then the black satin band and the striped black plate. Band and plate
// are empty here, as MiniCard carries no text. The red rim and the black
// half are what tell this card from the normal one (gold rim, photo to the
// bottom) at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { BAND, FACETS_MINI, FOOT_VEIL, ONYX, SNOW, STRIPES, TOTW_RIM_FLAT, TotwFacetStyles } from "./totwFinish";

// One layer over the lower part of the card (it starts at 57% of the height).
// Three pictures, top one first:
//   · down the layer: the upper zone sinking into black, nothing over the
//     band except the shade at its lower edge, nothing over the plate, the
//     lighter foot;
//   · the band (from 15% to 37% of the layer);
//   · the striped plate (from 37% down).
const PLATE =
  "linear-gradient(to bottom, " +
  "rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 12%, #000 15%, " +
  "rgba(0,0,0,0) 15%, rgba(0,0,0,0) 31%, rgba(0,0,0,0.7) 37%, " +
  `rgba(0,0,0,0) 37%, rgba(0,0,0,0) 68%, ${FOOT_VEIL} 68%, ${FOOT_VEIL} 100%), ` +
  `${BAND} 0 19.23% / 100% 22% no-repeat, ` +
  `${STRIPES} bottom / 100% 63% no-repeat`;

// Photo cards only: the same lower layer with the black turned to deep red —
// the fade, the band and the striped plate all keep their shapes.
const RED_DEEP = "#3A0507";
const RED_STRIPE = "#5A0B0E";
const RED_BAND =
  "linear-gradient(90deg, #2A0304 0%, #43070A 13%, #5E0D11 26%, #761318 39%, #84171C 50%, #761318 61%, #5E0D11 74%, #43070A 87%, #2A0304 100%)";
const RED_STRIPES =
  `linear-gradient(56.6deg, ${RED_DEEP} 0%, ${RED_DEEP} 8.1%, ${RED_STRIPE} 8.5%, ${RED_STRIPE} 19.2%, ${RED_DEEP} 19.6%, ${RED_DEEP} 32.2%, ` +
  `${RED_STRIPE} 32.6%, ${RED_STRIPE} 43.6%, ${RED_DEEP} 44%, ${RED_DEEP} 57.9%, ${RED_STRIPE} 58.3%, ${RED_STRIPE} 100%)`;
const PLATE_RED =
  "linear-gradient(to bottom, " +
  `rgba(58,5,7,0) 0%, rgba(58,5,7,0.9) 12%, ${RED_DEEP} 15%, ` +
  "rgba(0,0,0,0) 15%, rgba(0,0,0,0) 31%, rgba(20,0,0,0.55) 37%, " +
  `rgba(0,0,0,0) 37%, rgba(0,0,0,0) 68%, ${FOOT_VEIL} 68%, ${FOOT_VEIL} 100%), ` +
  `${RED_BAND} 0 19.23% / 100% 22% no-repeat, ` +
  `${RED_STRIPES} bottom / 100% 63% no-repeat`;

export default function TotwMiniCard({
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
      {!hasPhoto && <TotwFacetStyles mini />}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: TOTW_RIM_FLAT }} />
      <div className="absolute inset-[2px] overflow-hidden" style={{ clipPath: SHIELD, background: ONYX }}>
        {hasPhoto ? (
          <PlayerImage
            src={photo}
            alt=""
            width={112}
            height={157}
            className="absolute inset-0 h-full w-full object-cover object-top"
            animate={false}
          />
        ) : (
          <div aria-hidden className={`absolute inset-x-0 top-0 h-[66%] ${FACETS_MINI}`} />
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[57%]" style={{ background: hasPhoto ? PLATE_RED : PLATE }} />
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
            style={{ color: SNOW, opacity: 0.9 }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
