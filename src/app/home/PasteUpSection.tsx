// Home welcome strip background — «Αφισοκόλληση» (fly-posting): one big gold
// poster pasted up in sheets that don't quite line up. A black slab leans at
// the angle of the italic title, with a second orange print out of register.
//
// Drawn entirely in CSS + inline SVG. Server component, static markup: no
// photos, no canvas, no runtime JS. Replaces the old Vanta/canvas background.

import React from "react";

const GOLD = "#f4c253";
const INK = "#0b0b0d";
const PRINT_ORANGE = "#ee7b1f";

const svgUri = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** Fine film grain, white specks on transparent. Tiled. */
const GRAIN = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .5 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`,
);

/** Wheat-paste wrinkles: long soft creases, lit from one side. Tiled. */
const WRINKLES = svgUri(
  `<svg xmlns='http://www.w3.org/2000/svg' width='640' height='640'><filter id='w' x='0' y='0' width='100%' height='100%'><feTurbulence type='fractalNoise' baseFrequency='.005 .02' numOctaves='3' seed='11' stitchTiles='stitch'/><feDiffuseLighting surfaceScale='10' lighting-color='#fff'><feDistantLight azimuth='35' elevation='60'/></feDiffuseLighting></filter><rect width='100%' height='100%' filter='url(#w)'/></svg>`,
);

type Sheet = { dx: number; dy: number; tint: string };

const SHEETS_DESKTOP: Sheet[] = [
  { dx: 0, dy: 0, tint: "rgba(255,255,255,.06)" },
  { dx: 1, dy: 3, tint: "rgba(214,120,0,.10)" },
  { dx: -1, dy: -2, tint: "rgba(0,0,0,0)" },
  { dx: 1, dy: 2, tint: "rgba(255,255,255,.05)" },
  { dx: -1, dy: -3, tint: "rgba(214,120,0,.12)" },
  { dx: 0, dy: 1, tint: "rgba(0,0,0,.03)" },
];
const SHEETS_PHONE: Sheet[] = [
  { dx: 0, dy: 0, tint: "rgba(255,255,255,.06)" },
  { dx: 1, dy: 3, tint: "rgba(214,120,0,.11)" },
  { dx: -1, dy: -2, tint: "rgba(0,0,0,0)" },
];

function Art({ phone, tint }: { phone: boolean; tint: string }) {
  // The slab leans at the angle of the italic title.
  const slab = phone
    ? "polygon(0 40px, 100% 12px, 100% calc(100% - 40px), 0 calc(100% - 12px))"
    : "polygon(calc(50% - 452px) 26px, calc(50% + 512px) 26px, calc(50% + 452px) calc(100% - 26px), calc(50% - 512px) calc(100% - 26px))";
  return (
    <>
      <div className="absolute inset-0" style={{ background: GOLD }} />
      {/* each sheet has faded a little differently */}
      <div className="absolute inset-0" style={{ background: tint }} />
      {/* second colour, printed out of register */}
      <div
        className="absolute inset-0"
        style={{
          background: PRINT_ORANGE,
          clipPath: slab,
          transform: phone ? "translate(0, 9px)" : "translate(-13px, 9px)",
        }}
      />
      <div className="absolute inset-0" style={{ background: INK, clipPath: slab }} />
    </>
  );
}

function Sheets({ list, phone }: { list: Sheet[]; phone: boolean }) {
  return (
    <div className={`absolute inset-0 ${phone ? "sm:hidden" : "hidden sm:block"}`}>
      {list.map((s, i) => (
        <div
          key={i}
          className="absolute inset-y-0 overflow-hidden"
          style={{ left: `${(i * 100) / list.length}%`, width: `calc(${100 / list.length}% + 1px)` }}
        >
          <div
            className="absolute"
            style={{
              left: `${-i * 100}%`,
              width: `${list.length * 100}%`,
              top: -12,
              bottom: -12,
              transform: `translate(${s.dx}px, ${s.dy}px)`,
            }}
          >
            <div className="absolute inset-x-0" style={{ top: 12, bottom: 12 }}>
              <Art phone={phone} tint={s.tint} />
            </div>
            {/* bleed, so a shifted sheet never shows a gap */}
            <div className="absolute inset-x-0 top-0" style={{ height: 12, background: GOLD }} />
            <div className="absolute inset-x-0 bottom-0" style={{ height: 12, background: GOLD }} />
          </div>
          {/* the overlap where one sheet sits on the next */}
          <div
            className="absolute inset-0"
            style={{
              boxShadow:
                "inset 1px 0 0 rgba(255,255,255,.10), inset -1px 0 0 rgba(0,0,0,.34), inset -5px 0 6px -4px rgba(0,0,0,.28)",
            }}
          />
        </div>
      ))}
    </div>
  );
}

export default function PasteUpSection({
  className = "",
  children,
}: React.PropsWithChildren<{ className?: string }>) {
  return (
    <section className={`relative isolate overflow-hidden ${className}`} style={{ backgroundColor: "#08080a" }}>
      <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <Sheets list={SHEETS_DESKTOP} phone={false} />
        <Sheets list={SHEETS_PHONE} phone />
        {/* paste wrinkles, then paper + ink grain */}
        <div
          className="absolute inset-0 opacity-[0.42] mix-blend-multiply"
          style={{ backgroundImage: WRINKLES, backgroundSize: "640px 640px" }}
        />
        <div
          className="absolute inset-0 opacity-[0.16] mix-blend-overlay"
          style={{ backgroundImage: GRAIN, backgroundSize: "200px 200px" }}
        />
      </div>
      <div className="relative z-20">{children}</div>
    </section>
  );
}
