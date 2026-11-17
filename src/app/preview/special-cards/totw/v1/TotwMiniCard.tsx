// The «Ομάδα της Εβδομάδας» card as it sits in a list row: MiniCard in the
// Team-of-the-Week finish. Flat and still like MiniCard (there are hundreds
// on a page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo with the big card's red corner mounts
// (or the team logo on red facets) on top, one thin line where the black
// begins, then the black lower half, faintly faceted like the normal mini. The black is empty here, as MiniCard
// carries no text.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { FACETS_MINI as ONYX_FACETS_MINI, OnyxFacetStyles } from "@/app/preview/paiktes-v2/[id]/onyxFinish";
import { FACETS_MINI, FACETS_MINI_MOUNT, ONYX, RULE, SNOW, TITLE, TOTW_RIM_FLAT, TotwFacetStyles } from "./totwFinish";

// One layer over the lower part of the card (it starts at 47% of the height, so its line sits at 55% — where the big card's black begins):
// nothing but the one thin line (at 15% of the layer). The photo, or the red
// facets, run clean down to it — no shade above the line — and the faceted
// black starts right under it.
const PLATE = `linear-gradient(to bottom, transparent 15%, ${RULE} 15%, ${RULE} calc(15% + 1px), transparent calc(15% + 1px))`;

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
      <TotwFacetStyles mini />
      <OnyxFacetStyles mini />
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: TOTW_RIM_FLAT }} />
      <div className="absolute inset-[2px] overflow-hidden" style={{ clipPath: SHIELD, background: ONYX }}>
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
            {/* The big card's corner mounts round the photo, made small. */}
            <div aria-hidden className={`absolute inset-x-0 top-0 ${FACETS_MINI_MOUNT}`} style={{ height: "55.2%" }} />
          </>
        ) : (
          <div aria-hidden className={`absolute inset-x-0 top-0 ${FACETS_MINI}`} style={{ height: "56%" }} />
        )}
        {/* The black half, faintly faceted: the normal mini's onyx picture, in grey. */}
        <div
          aria-hidden
          className={`absolute inset-0 ${ONYX_FACETS_MINI}`}
          style={{ clipPath: "inset(55% 0 0 0)", filter: "grayscale(1)" }}
        />
        <div aria-hidden className="absolute inset-x-0 bottom-0" style={{ top: "47.06%", background: PLATE }} />
        {/* The edition's title in the black. Drawn as a picture, so it
            keeps its place and size whatever the card's width. */}
        <svg aria-hidden viewBox="0 0 100 140" className="absolute inset-0 h-full w-full" fill="#EF4B47" fontWeight={700} textAnchor="middle">
          <text x="51.5" y="108" fontSize="17" letterSpacing="3">
            {TITLE}
          </text>
        </svg>
        {hasPhoto ? null : hasLogo ? (
          <div className="absolute" style={{ left: "22%", right: "22%", top: "8%", height: "41%" }}>
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
            className="absolute inset-x-0 top-[12%] text-center text-2xl font-bold"
            style={{ color: SNOW, opacity: 0.9 }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
