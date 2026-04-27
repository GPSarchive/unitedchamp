// src/app/preview/paiktes-v2/page.tsx
// Preview page for the redesigned 3D player card (v2.0 "Midnight Dossier")
"use client";

import { useState } from "react";
import {
  Fraunces,
  Archivo_Black,
  JetBrains_Mono,
  Figtree,
} from "next/font/google";
import ProfileCardV2, { ProfileCardV2Props } from "./ProfileCardV2";

const fraunces = Fraunces({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "600", "700", "900"],
  style: ["normal", "italic"],
  variable: "--f-display",
  display: "swap",
});
const archivoBlack = Archivo_Black({
  subsets: ["latin", "latin-ext"],
  weight: ["400"],
  variable: "--f-brutal",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin", "greek"],
  weight: ["400", "500", "700"],
  variable: "--f-mono",
  display: "swap",
});
const figtree = Figtree({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--f-body",
  display: "swap",
});

type Sample = ProfileCardV2Props & { id: number };

const SAMPLES: Sample[] = [
  {
    id: 7,
    fileNumber: 7,
    firstName: "Γιώργος",
    lastName: "Παπαδόπουλος",
    meta: "FW · 182cm · 27y",
    avatarUrl: "/player-placeholder.svg",
    teams: [
      { id: 1, name: "Ultra FC", logo: null },
      { id: 2, name: "Champions", logo: null },
    ],
    stats: [
      { label: "Αγώνες", value: 48 },
      { label: "Γκολ", value: 24, accent: "orange" },
      { label: "Ασίστ", value: 11 },
      { label: "MVP", value: 3, accent: "gold" },
    ],
  },
  {
    id: 21,
    fileNumber: 21,
    firstName: "Δημήτρης",
    lastName: "Κωνσταντίνου",
    meta: "GK · 190cm · 31y",
    avatarUrl: "/player-placeholder.svg",
    teams: [{ id: 3, name: "Atlas United", logo: null }],
    stats: [
      { label: "Αγώνες", value: 62 },
      { label: "Γκολ", value: 1 },
      { label: "Τερμ.", value: 6, accent: "cyan" },
      { label: "MVP", value: 2, accent: "gold" },
    ],
    isTournamentScoped: true,
  },
  {
    id: 9,
    fileNumber: 9,
    firstName: "Νίκος",
    lastName: "Αντωνίου",
    meta: "MF · 175cm · 24y",
    avatarUrl: "/player-placeholder.svg",
    teams: [
      { id: 4, name: "Delta", logo: null },
      { id: 5, name: "North Star", logo: null },
      { id: 6, name: "Ultra FC", logo: null },
    ],
    stats: [
      { label: "Αγώνες", value: 35 },
      { label: "Γκολ", value: 7 },
      { label: "Ασίστ", value: 14, accent: "orange" },
    ],
  },
];

export default function PaiktesV2PreviewPage() {
  const [tilt, setTilt] = useState(true);

  return (
    <div
      className={`${fraunces.variable} ${archivoBlack.variable} ${jetbrains.variable} ${figtree.variable} relative min-h-screen w-full text-[#F3EFE6]`}
      style={{ fontFamily: "var(--f-body)" }}
    >
      {/* backdrop — same treatment as /paiktes PaperBackground */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, #1a1a2e 0%, #0a0a14 45%, #08080f 100%)",
          }}
        />
        <div
          className="absolute -top-40 -left-40 h-[60rem] w-[60rem] rounded-full opacity-[0.18] blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, #fb923c 0%, rgba(251,146,60,0) 70%)",
          }}
        />
        <div
          className="absolute -bottom-60 -right-40 h-[55rem] w-[55rem] rounded-full opacity-[0.14] blur-3xl"
          style={{
            background:
              "radial-gradient(closest-side, #a855f7 0%, rgba(168,85,247,0) 70%)",
          }}
        />
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]">
          <defs>
            <pattern id="pgrid-v2" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#F3EFE6" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#pgrid-v2)" />
        </svg>
      </div>

      <header className="border-b-2 border-[#F3EFE6]/20">
        <div className="mx-auto max-w-[1800px] px-4 md:px-6 pt-6 pb-4 md:pt-8 md:pb-6">
          <nav className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
            <span>Preview</span>
            <span>/</span>
            <span>Παίκτες</span>
            <span>/</span>
            <span className="text-[#fb923c]">3D Card v2.0</span>
          </nav>

          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <span
                className="inline-block font-mono text-[10px] uppercase tracking-[0.3em] text-[#fb923c]"
                style={{ marginBottom: 8 }}
              >
                / 00 · Midnight Dossier
              </span>
              <h1
                className="font-black italic leading-[0.9] tracking-[-0.02em] text-[#F3EFE6]"
                style={{
                  fontFamily: "var(--f-display)",
                  fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
                }}
              >
                Player Card · v2.0
              </h1>
              <p className="mt-2 max-w-xl font-mono text-[11px] uppercase tracking-[0.22em] text-[#F3EFE6]/55">
                Theme-aligned redesign of the paiktes 3D card. Hover to tilt.
              </p>
            </div>

            <label className="inline-flex items-center gap-2 border-2 border-[#F3EFE6]/20 bg-[#13131d] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/75 cursor-pointer">
              <input
                type="checkbox"
                checked={tilt}
                onChange={(e) => setTilt(e.target.checked)}
                className="accent-[#fb923c]"
              />
              3D Tilt
            </label>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1800px] px-4 md:px-6 py-10 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-10 md:gap-14">
          {SAMPLES.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-4">
              <ProfileCardV2 {...s} enableTilt={tilt} />
              <div className="mt-2 w-full max-w-[440px] border-t-2 border-[#F3EFE6]/15 pt-3 font-mono text-[10px] uppercase tracking-[0.25em] text-[#F3EFE6]/55 flex items-center justify-between">
                <span>
                  N°{String(s.fileNumber).padStart(3, "0")} · {s.lastName}
                </span>
                <span className="text-[#fb923c]">
                  {s.isTournamentScoped ? "Τουρνουά" : "Καριέρα"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t-2 border-[#F3EFE6]/15 bg-[#0a0a14]/60">
        <div className="mx-auto max-w-[1800px] px-4 md:px-6 py-5 font-mono text-[10px] uppercase tracking-[0.3em] text-[#F3EFE6]/45 flex flex-wrap items-center justify-between gap-3">
          <span>Preview route · Live page untouched at /paiktes</span>
          <span className="text-[#fb923c]">/ end</span>
        </div>
      </footer>
    </div>
  );
}
