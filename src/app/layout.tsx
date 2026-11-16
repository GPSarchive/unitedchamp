// /src/app/layout.tsx
import React, { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";

import Navbar from "./lib/Navbar/Navbar";
import ConsentProvider from "./lib/consent/ConsentProvider";
import ConsentGatedAnalytics from "./lib/consent/ConsentGatedAnalytics";
import CookieBanner from "./lib/consent/CookieBanner";
import Footer from "./lib/Footer/Footer";
import { loadPublicSkinsCached } from "./preview/special-cards/publicSkins";
// Only the tiny context module: importing SkinnedCards here would ship all the
// card code to every page.
import { CardSkinsProvider } from "./preview/special-cards/skinsContext";
import {
  Geist,
  Geist_Mono,
  Roboto_Condensed,
  Ubuntu_Condensed,
  Noto_Sans,
} from "next/font/google";

// --- Fonts ---
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const robotoCondensed = Roboto_Condensed({
  subsets: ["latin", "greek"],
  weight: ["300", "400", "700"],
  variable: "--font-roboto-condensed",
  display: "swap",
});

const ubuntuCondensed = Ubuntu_Condensed({
  subsets: ["latin", "greek"],
  weight: ["400"],
  variable: "--font-ubuntu-condensed",
  display: "swap",
});

const notoSans = Noto_Sans({
  subsets: ["latin", "greek"],
  weight: ["400", "700"],
  variable: "--font-noto-sans",
  display: "swap",
});

// --- Metadata ---
export const metadata: Metadata = {
  metadataBase: new URL("https://ultrachamp.gr"),
  title: "UltraChamp.gr",
  description: "Το απόλυτο ελληνικό site για πρωταθλήματα mini football!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Helper — reuse whenever you add external/inline scripts in the future.
// CSP lives in src/proxy.ts: public routes get a nonce-less policy (their
// HTML is ISR-cached, so a per-request nonce would mismatch and block every
// script). The force-dynamic /dashboard keeps the strict nonce policy: the
// proxy forwards the full CSP on the *request* headers, which is where Next
// reads the nonce from to stamp its own inline scripts (x-nonce alone is
// only a convention for app code and is invisible to the framework).
// Do NOT read headers()/cookies() in this layout: any dynamic API at the
// root opts every route out of static rendering / ISR.
function NoncedScript(
  props: Omit<React.ComponentProps<typeof Script>, "nonce"> & { nonce?: string }
) {
  const { nonce, ...rest } = props;
  return <Script {...rest} nonce={nonce} />;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // The special card skins given on /dashboard/protathlites, for every page
  // that draws a player card (SkinnedMiniCard / SkinnedBigCard). One read from
  // the data cache (unstable_cache with no time limit, tag expired by the
  // dashboard on every change): no cookies/headers and no revalidate of its
  // own, so static pages stay static and ISR pages keep their own interval.
  const skins = await loadPublicSkinsCached();

  const htmlClass = [
    robotoCondensed.variable,
    ubuntuCondensed.variable,
    notoSans.variable,
    geistSans.variable,
    geistMono.variable,
  ].join(" ");

  return React.createElement(
    "html",
    {
      lang: "el",
      className: htmlClass,
      suppressHydrationWarning: true,
      // Inline so the dark base paints with the initial HTML, BEFORE the external
      // CSS chunk loads — otherwise the browser default-white shows as a flash.
      style: { backgroundColor: "#09090b", colorScheme: "dark" },
    },
    [
      React.createElement(
        "head",
        { key: "head" },
        [
          React.createElement(
            "style",
            { key: "brand-style" },
            `:root { --brand-h: 220 }`
          ),

          // ────────────────────────────────────────────────────────
          // Future external scripts go here with NoncedScript:
          //
          // React.createElement(NoncedScript, {
          //   key: "widget",
          //   src: "https://cdn.jsdelivr.net/npm/some-widget/dist/widget.min.js",
          //   strategy: "afterInteractive",
          //   nonce,
          // }),
          // ────────────────────────────────────────────────────────
        ]
      ),

      React.createElement(
        "body",
        {
          key: "body",
          className: "antialiased font-sans",
          suppressHydrationWarning: true,
          style: { backgroundColor: "#09090b" },
        },
        React.createElement(ConsentProvider, {
          key: "consent-provider",
          children: [
            React.createElement(
              Suspense,
              {
                key: "nav",
                fallback: React.createElement("div", { className: "h-16 md:h-32" }),
              },
              React.createElement(Navbar)
            ),
            React.createElement(
              "main",
              { key: "main", className: "pt-[var(--nav-h)]" },
              React.createElement(CardSkinsProvider, { skins, children })
            ),
            React.createElement(Footer, { key: "footer" }),
            React.createElement(ConsentGatedAnalytics, { key: "gated-analytics" }),
            React.createElement(CookieBanner, { key: "cookie-banner" }),
          ],
        })
      ),
    ]
  );
}