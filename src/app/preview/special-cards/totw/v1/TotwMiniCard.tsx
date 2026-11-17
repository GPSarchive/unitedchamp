// The «Ομάδα της Εβδομάδας» card as it sits in a list row: MiniCard in the
// Team-of-the-Week finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on red facets) on
// top, one thin line where the black begins, then the black lower half,
// faintly faceted like the normal mini. The black is empty here, as MiniCard
// carries no text.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { FACETS_MINI as ONYX_FACETS_MINI, OnyxFacetStyles } from "@/app/preview/paiktes-v2/[id]/onyxFinish";
import { FACETS_MINI, ONYX, RULE, SNOW, TOTW_RIM_FLAT, TotwFacetStyles } from "./totwFinish";

// One layer over the lower part of the card (it starts at 57% of the height):
// the upper zone sinks into the black, then the one thin line (at 15% of the
// layer); below it the layer is clear and the faceted black shows.
const PLATE =
  "linear-gradient(to bottom, rgba(10,10,10,0) 0%, rgba(10,10,10,0.9) 12%, " +
  `${ONYX} 15%, ${RULE} 15%, ${RULE} calc(15% + 1px), transparent calc(15% + 1px), transparent 100%)`;

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
      <OnyxFacetStyles mini />
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
        {/* The black half, faintly faceted: the normal mini's onyx picture, in grey. */}
        <div
          aria-hidden
          className={`absolute inset-0 ${ONYX_FACETS_MINI}`}
          style={{ clipPath: "inset(63% 0 0 0)", filter: "grayscale(1)" }}
        />
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
