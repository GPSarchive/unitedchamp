// The «Ομάδα της Εβδομάδας» card as it sits in a list row: MiniCard in the
// Team-of-the-Week finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on red facets) on
// top, then the black band between its two red rules and the striped black
// plate. Band and plate are empty here, as MiniCard carries no text. The red
// rim and the two red lines across the black are what tell this card from
// the normal one (gold rim, photo to the bottom) at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { FACETS_MINI, FOOT_VEIL, ONYX, SNOW, STRIPES, TOTW_RIM_FLAT, TotwFacetStyles } from "./totwFinish";

const RED = "#E0302B";

// One layer over the lower part of the card (it starts at 57% of the height).
// From the top: the fade to black, the first rule, the glossy band, the second
// rule, the plate with its stripes, the lighter foot.
const PLATE =
  // the band's gloss
  "radial-gradient(ellipse 50% 13% at 50% 25%, rgba(255,255,255,0.24) 0%, rgba(255,255,255,0.1) 55%, rgba(255,255,255,0) 100%), " +
  // fade, rule, band, rule, (plate shows through), foot
  "linear-gradient(to bottom, " +
  "rgba(0,0,0,0) 0%, rgba(0,0,0,0.9) 12%, " +
  `#000 15%, ${RED} 15%, ${RED} calc(15% + 1px), ` +
  "#000 calc(15% + 1px), #000 37%, " +
  `${RED} 37%, ${RED} calc(37% + 1px), ` +
  `rgba(0,0,0,0) calc(37% + 1px), rgba(0,0,0,0) 68%, ${FOOT_VEIL} 68%, ${FOOT_VEIL} 100%), ` +
  // the plate: the lower 63% of this layer
  `${STRIPES} bottom / 100% 63% no-repeat`;

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
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[57%]" style={{ background: PLATE }} />
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
