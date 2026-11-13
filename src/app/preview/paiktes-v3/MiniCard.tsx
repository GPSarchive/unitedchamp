// The player's card as it sits in a list row: the profile card's shield, flat
// and still (no tilt, no effects — there are hundreds on a page). The photo
// fills it; without a photo the team logo sits in the middle.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "../paiktes-v2/[id]/cardShared";

const GOLD_RIM = "linear-gradient(150deg, #D4AF37 0%, #FFE08A 35%, #C99A1E 65%, #FFD866 100%)";
const SURFACE = "radial-gradient(circle at 30% 20%, rgba(212,175,55,0.22) 0%, transparent 65%), #0b0b0d";

export default function MiniCard({
  photo,
  logo,
  initial,
}: {
  photo: string | null;
  /** Main team's logo, shown when there is no photo. */
  logo: string | null;
  /** Shown when there is neither. */
  initial: string;
}) {
  const hasPhoto = !isPlaceholderPhoto(photo);
  const hasLogo = !isPlaceholderPhoto(logo);
  return (
    <div className="relative aspect-[5/7] w-full">
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: GOLD_RIM }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: SURFACE }}>
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
