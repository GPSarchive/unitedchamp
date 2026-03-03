// /src/app/layout.tsx
import React from "react";
import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

import Navbar from "./lib/Navbar/Navbar";
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
  title: "UltraChamp.gr",
  description: "Το απόλυτο ελληνικό site για πρωταθλήματα mini football!",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Helper — reuse whenever you add external/inline scripts in the future.
// Every <Script> that goes through this gets the CSP nonce automatically.
function NoncedScript(
  props: Omit<React.ComponentProps<typeof Script>, "nonce"> & { nonce?: string }
) {
  const { nonce, ...rest } = props;
  return <Script {...rest} nonce={nonce} />;
}

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  const htmlClass = [
    robotoCondensed.variable,
    ubuntuCondensed.variable,
    notoSans.variable,
    geistSans.variable,
    geistMono.variable,
  ].join(" ");

  return React.createElement(
    "html",
    { lang: "el", className: htmlClass, suppressHydrationWarning: true },
    [
      React.createElement(
        "head",
        { key: "head" },
        [
          // ────────────────────────────────────────────────────────
          // Nonced inline style — safe, sets CSS custom property.
          // ────────────────────────────────────────────────────────
          React.createElement(
            "style",
            { key: "nonce-style", nonce },
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
        { key: "body", className: "antialiased font-sans", suppressHydrationWarning: true },
        [
          React.createElement(Navbar, { key: "nav" }),
          React.createElement(
            "main",
            { key: "main", className: "pt-16 md:pt-32" },
            children
          ),

          React.createElement(Analytics, { key: "analytics" }),
        ]
      ),
    ]
  );
}