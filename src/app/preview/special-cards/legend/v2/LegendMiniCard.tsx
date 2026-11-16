// The «Θρύλος» (Legend) card as it sits in a list row, version 2: MiniCard in
// the Legend finish. Flat and still like MiniCard (there are hundreds on a
// page) — no tilt, no effects, nothing that moves.
//
// It is the big card made small: the photo set into faceted pale gold (the
// gold shows as the two top corners and down both sides), or the team logo on
// the gold when there is no photo; below it the ivory plate under one gold
// rule. The pale gold and the ivory point are what tell this card from the
// black one at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { BRONZE, FACETS_MINI, IVORY, LEGEND_RIM_FLAT, LegendFacetStyles } from "./legendFinish";

// The photo's window: the big card's cut, simpler.
const WINDOW = "polygon(50% 0%, 70% 3%, 100% 27%, 100% 100%, 0% 100%, 0% 27%, 30% 3%)";

// One layer over the foot of the card (it starts at 75% of the height): the
// gold rule, then ivory shading to champagne at the point.
const PLATE = "linear-gradient(to bottom, #C6A94F 0, #C6A94F 1px, #FCFAF1 1px, #FCFAF1 26%, #E9E2C6 100%)";

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
      <LegendFacetStyles mini />
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: LEGEND_RIM_FLAT }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: IVORY }}>
        <div aria-hidden className={`absolute inset-x-0 top-0 h-[76%] ${FACETS_MINI}`} />
        {hasPhoto ? (
          <div
            className="absolute inset-x-[7%] top-[3.5%] bottom-[25%] overflow-hidden"
            style={{ clipPath: WINDOW, background: "#17150F" }}
          >
            <PlayerImage
              src={photo}
              alt=""
              width={112}
              height={157}
              className="absolute inset-x-0 top-0 aspect-[5/7] w-full object-cover object-top"
              animate={false}
            />
          </div>
        ) : hasLogo ? (
          <div className="absolute inset-x-[15%] top-[12%] h-[54%]">
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
            className="absolute inset-x-0 top-[18%] text-center text-2xl font-bold"
            style={{ color: BRONZE, opacity: 0.8 }}
          >
            {initial}
          </div>
        )}
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[75%]" style={{ background: PLATE }} />
      </div>
    </div>
  );
}
