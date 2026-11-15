// The player's card as it sits in a list row: the profile card's shield, flat
// and still (no tilt, no effects — there are hundreds on a page). The photo
// fills it; without a photo the team logo sits in the middle.
//
// Its surface is the profile card's faceted onyx with a coarse mesh of its own
// (onyxFinish.tsx), calm in the middle where the logo stands — at 52–56px a
// few clear facets at the top and a glint low on the left, not noise. One CSS
// background, the same picture for every card on the page.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "../paiktes-v2/[id]/cardShared";
import { FACETS_MINI, OnyxFacetStyles } from "../paiktes-v2/[id]/onyxFinish";

const GOLD_RIM = "linear-gradient(150deg, #D4AF37 0%, #FFE08A 35%, #C99A1E 65%, #FFD866 100%)";

export default function MiniCard({
  photo,
  logo,
  initial,
  surface,
}: {
  photo: string | null;
  /** Main team's logo, shown when there is no photo. */
  logo: string | null;
  /** Shown when there is neither. */
  initial: string;
  /** A flat CSS background instead of the faceted onyx — only to compare with the old look. */
  surface?: string;
}) {
  const hasPhoto = !isPlaceholderPhoto(photo);
  const hasLogo = !isPlaceholderPhoto(logo);
  const faceted = surface == null;
  return (
    <div className="relative aspect-[5/7] w-full">
      {faceted && <OnyxFacetStyles mini />}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: GOLD_RIM }} />
      <div
        className={`absolute inset-[1.5px] overflow-hidden ${faceted ? FACETS_MINI : ""}`}
        style={{ clipPath: SHIELD, background: surface }}
      >
        {hasPhoto ? (
          <PlayerImage
            src={photo}
            alt=""
            width={112}
            height={157}
            className="absolute inset-0 h-full w-full object-cover object-top"
            animate={false}
          />
        ) : hasLogo ? (
          <div className="absolute inset-x-[14%] top-[17%] h-[52%]">
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
            className="absolute inset-x-0 top-[24%] text-center text-2xl font-bold text-[#D4AF37]/60"
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
