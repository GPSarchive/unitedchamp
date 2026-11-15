// The «Θρύλος» (Legend) card as it sits in a list row: MiniCard in the Legend
// finish. Flat and still like MiniCard (there are hundreds on a page) — no
// tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on pale-gold
// facets) on top, then the ivory plate with its two gold rules. The plate is
// empty here, as MiniCard carries no text; it is what tells this card from
// the black one at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { BRONZE, FACETS_MINI, IVORY, LEGEND_RIM_FLAT, LegendFacetStyles } from "./legendFinish";

// One layer over the lower part of the card (it starts at 57% of the height):
// the fade to white, the first rule, the name band, the second rule, the foot.
const PLATE =
  "linear-gradient(to bottom, " +
  "rgba(254,254,251,0) 0%, rgba(254,254,251,0.9) 12%, " +
  "#fff 15%, #CDB360 15%, #CDB360 calc(15% + 1px), " +
  "#FBF9F1 calc(15% + 1px), #FEFEFD 26%, #FBF9F1 37%, " +
  "#CDB360 37%, #CDB360 calc(37% + 1px), " +
  "#FEFEFB calc(37% + 1px), #FEFEFB 66%, #F1EFE7 66%, #FEFEFB 100%)";

export default function LegendMiniCard({
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
      {!hasPhoto && <LegendFacetStyles mini />}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: LEGEND_RIM_FLAT }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: IVORY }}>
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
          <div aria-hidden className={`absolute inset-x-0 top-0 h-[64%] ${FACETS_MINI}`} />
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
            style={{ color: BRONZE, opacity: 0.75 }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
