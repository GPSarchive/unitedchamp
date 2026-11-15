// The «Επαγγελματίας» (Pro Player) card as it sits in a list row: MiniCard in
// the Pro finish. Flat and still like MiniCard (there are hundreds on a page)
// — no tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on teal facets) on
// top, then the aqua name band between its two mint lines, the teal plate
// with its slanted sheen and the mint foot. The plate is empty here, as
// MiniCard carries no text; its colour is what tells this card from the black
// one and from the ivory «Θρύλος» at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { DEEP, FACETS_MINI, FOOT_LINE, INK, PLATE, PLATE_SHADE, PRO_RIM_FLAT, ProFacetStyles } from "./proFinish";

// One layer over the lower part of the card (it starts at 57% of the height):
// the fade to deep teal, the first line, the name band, the second line, the
// plate, the dark line, the foot.
const LOWER =
  "linear-gradient(to bottom, " +
  "rgba(8,149,127,0) 0%, rgba(8,149,127,0.9) 12%, " +
  `${DEEP} 15%, #6CF5E1 15%, #6CF5E1 calc(15% + 1px), ` +
  "#3DCEB8 calc(15% + 1px), #45D6C0 26%, #3DCEB8 37%, " +
  "#6CF5E1 37%, #6CF5E1 calc(37% + 1px), " +
  `${PLATE} calc(37% + 1px), ${PLATE} 66%, ${FOOT_LINE} 66%, ${FOOT_LINE} calc(66% + 1px), ` +
  "#4DDEC8 calc(66% + 1px), #3DCEB8 100%)";
// The plate's sheen: two darker bands leaning right. Laid over the plate only
// (from under the second line to the dark line: 37%–66% of the layer above,
// less the 1px of each line), see `SHEEN_BOX`.
const SHEEN_BOX = "0 calc(52.11% + 0.48px) / 100% calc(29% - 1px) no-repeat";
const SHEEN =
  `linear-gradient(59deg, rgba(16,161,139,0) 0%, rgba(16,161,139,0) 12%, ${PLATE_SHADE} 13%, ` +
  `${PLATE_SHADE} 30%, rgba(16,161,139,0) 31%, rgba(16,161,139,0) 44%, ${PLATE_SHADE} 45%, ` +
  `${PLATE_SHADE} 60%, rgba(16,161,139,0) 61%, rgba(16,161,139,0) 100%)`;

export default function ProMiniCard({
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
      {!hasPhoto && <ProFacetStyles mini />}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: PRO_RIM_FLAT }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: PLATE }}>
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
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 top-[57%]"
          style={{ background: `${SHEEN} ${SHEEN_BOX}, ${LOWER}` }}
        />
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
            style={{ color: INK, opacity: 0.8 }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
