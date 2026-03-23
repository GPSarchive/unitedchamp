// next.config.ts
import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const APP_ORIGIN =
  process.env.NEXT_PUBLIC_APP_ORIGIN ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);

const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : undefined;
const appUrl = APP_ORIGIN ? new URL(APP_ORIGIN) : undefined;
const appHost = appUrl?.hostname;
const appProtocol = (appUrl?.protocol?.replace(":", "") as "http" | "https") || undefined;

const remotePatterns: RemotePattern[] = [];

/**
 * 1) Supabase Storage (public objects only)
 * Let Next Image Optimizer fetch from public storage.
 */
if (supabaseHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/storage/v1/object/public/**",
  });
}

/**
 * 2) Your own proxy for team logos (prod & dev)
 */
if (appHost && appProtocol) {
  remotePatterns.push({
    protocol: appProtocol,
    hostname: appHost,
    pathname: "/api/public/team-logo/**",
  });
}
// Explicit Vercel prod host for team logos
remotePatterns.push({
  protocol: "https",
  hostname: "unitedchamp.vercel.app",
  pathname: "/api/public/team-logo/**",
});
// Dev/local for team logos
remotePatterns.push(
  { protocol: "http", hostname: "localhost", port: "3000", pathname: "/api/public/team-logo/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/api/public/team-logo/**" },
);

// CDN for player images and other media
const CDN_DOMAIN = process.env.NEXT_PUBLIC_CDN_DOMAIN;
if (CDN_DOMAIN) {
  remotePatterns.push({
    protocol: "https",
    hostname: CDN_DOMAIN,
    pathname: "/**",
  });
}

/**
 * 3) Player image proxy (private bucket via same-origin API)
 * Add both local and production patterns for /api/player-img/**
 */
remotePatterns.push(
  { protocol: "http", hostname: "localhost", port: "3000", pathname: "/api/player-img/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/api/player-img/**" },
);
if (appHost && appProtocol) {
  remotePatterns.push({
    protocol: appProtocol,
    hostname: appHost,
    pathname: "/api/player-img/**",
  });
}
remotePatterns.push({
  protocol: "https",
  hostname: "unitedchamp.vercel.app",
  pathname: "/api/player-img/**",
});

/**
 * 4) Common avatar providers
 */
remotePatterns.push(
  { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
  { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
);

// Domains allowlist (kept for compatibility with older Next behavior)
const domains = Array.from(
  new Set(
    [
      supabaseHost,
      appHost,
      "unitedchamp.vercel.app",
      "localhost",
      "127.0.0.1",
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
      "www.ultrachamp.gr",
      "ultrachamp.gr",
    ].filter(Boolean) as string[],
  ),
);

const isProd = process.env.NODE_ENV === "production";

// Keep in sync with the Permissions-Policy set in src/middleware.ts.
// This copy covers static assets that bypass the middleware matcher.
const PERMISSIONS_POLICY = [
  "camera=()", "microphone=()", "geolocation=()",
  "usb=()", "bluetooth=()", "serial=()", "midi=()", "hid=()",
  "ambient-light-sensor=()", "accelerometer=()", "gyroscope=()",
  "magnetometer=()", "battery=()",
  "payment=()",
  "display-capture=()", "screen-wake-lock=()", "window-management=()",
  "fullscreen=(self)", "picture-in-picture=(self)",
  "autoplay=(self)", "encrypted-media=(self)",
  "clipboard-read=(self)", "clipboard-write=(self)",
  "otp-credentials=()", "publickey-credentials-create=()",
  "publickey-credentials-get=()", "identity-credentials-get=()",
  "interest-cohort=()", "idle-detection=()", "storage-access=()",
  "document-domain=()", "xr-spatial-tracking=()",
  "local-fonts=()", "web-share=()",
].join(", ");

const nextConfig: NextConfig = {
  // ──────────────────────────────────────────────────────────────
  // SECURITY: never ship source maps to the browser in production.
  // Default is already false, but explicit is safer — a future
  // Next.js upgrade can't silently flip the default on you.
  // ──────────────────────────────────────────────────────────────
  productionBrowserSourceMaps: false,

  // ──────────────────────────────────────────────────────────────
  // SECURITY: strip console.log/debug/info/trace from production
  // bundles at compile time via SWC. Zero runtime cost.
  // console.error and console.warn are preserved so Sentry / error
  // boundaries / monitoring still work.
  // ──────────────────────────────────────────────────────────────
  compiler: {
    removeConsole: isProd
      ? { exclude: ["error", "warn"] }
      : false,
  },

  images: {
    remotePatterns,
    domains,
  },

  poweredByHeader: false,

  async headers() {
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
     
    ];

    const prodOnly = isProd
      ? [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ]
      : [];

    return [
      {
        source: "/(.*)",
        headers: [
          ...baseHeaders,
          ...prodOnly,
          { key: "Permissions-Policy", value: PERMISSIONS_POLICY },
        ],
      },
    ];
  },
};

export default nextConfig;