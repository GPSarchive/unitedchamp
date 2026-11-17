// The «Ήρωας» (Hero) card as it sits in a list row: MiniCard in the Hero
// finish. Flat and still like MiniCard (there are hundreds on a page) — no
// tilt, no effects, nothing that moves.
//
// It is the big card made small: photo (or the team logo on purple facets) on
// top, then the name band between its two faint lines, the purple satin
// plate, the lighter foot. Band and plate are empty here, as MiniCard carries
// no text; their royal purple is what tells this card from the black one and
// from the ivory «Θρύλος» at a glance.
"use client";

import { PlayerImage } from "@/app/lib/OptimizedImage";
import { isPlaceholderPhoto } from "@/app/lib/image-config";
import { SHIELD } from "@/app/preview/paiktes-v2/[id]/cardShared";
import { DUSK_RGB, FACETS_MINI, HERO_RIM_FLAT, HeroFacetStyles, SNOW, TITLE, VIOLET } from "./heroFinish";

// One layer over the lower part of the card (it starts at 57% of the height):
// the fade to purple, the first line, the name band, the second line, the
// plate, the dark line, the foot.
const PLATE =
  "linear-gradient(to bottom, " +
  `rgba(${DUSK_RGB},0) 0%, rgba(${DUSK_RGB},0.9) 12%, ` +
  `rgb(${DUSK_RGB}) 15%, #8A5DD8 15%, #8A5DD8 calc(15% + 1px), ` +
  "#6530B4 calc(15% + 1px), #6B36BC 26%, #6530B4 37%, " +
  "#8A5DD8 37%, #8A5DD8 calc(37% + 1px), " +
  "#4E1F96 calc(37% + 1px), #4E1F96 68%, #24095A 68%, #24095A calc(68% + 1px), " +
  "#6035A0 calc(68% + 1px), #6035A0 100%)";

// The satin's slanted folds, over the plate and the foot only (from the
// second line down): lighter toward both sides, a darker strip between.
const FOLDS =
  "linear-gradient(68deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0) 42%, " +
  "rgba(20,4,60,0.22) 43.5%, rgba(20,4,60,0.22) 58%, rgba(255,255,255,0) 59.5%, rgba(255,255,255,0.08) 100%)";

export default function HeroMiniCard({
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
      {!hasPhoto && <HeroFacetStyles mini />}
      <div aria-hidden className="absolute inset-0" style={{ clipPath: SHIELD, background: HERO_RIM_FLAT }} />
      <div className="absolute inset-[1.5px] overflow-hidden" style={{ clipPath: SHIELD, background: VIOLET }}>
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
        <div aria-hidden className="absolute inset-x-0 bottom-0 top-[73%]" style={{ background: FOLDS }} />
        {/* The edition's title, in the name band. Drawn as a picture, so it keeps
            its place and size whatever the card's width. */}
        <svg aria-hidden viewBox="0 0 100 140" className="absolute inset-0 h-full w-full" fill="#FBF8FF" fontWeight={700} textAnchor="middle">
          <text x="50.5" y="99.5" fontSize="10" letterSpacing="1">
            {TITLE}
          </text>
        </svg>
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
            style={{ color: SNOW }}
          >
            {initial}
          </div>
        )}
      </div>
    </div>
  );
}
