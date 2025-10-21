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
// Explicit Vercel prod host
remotePatterns.push({
  protocol: "https",
  hostname: "unitedchamp.vercel.app",
  pathname: "/api/public/team-logo/**",
});
// Dev/local
remotePatterns.push(
  { protocol: "http", hostname: "localhost", port: "3000", pathname: "/api/public/team-logo/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/api/public/team-logo/**" },
);

/**
 * 2b) Public team-logo host served from ultrachamp.gr
 * (covers both www and apex domains)
 */
remotePatterns.push(
  { protocol: "https", hostname: "www.ultrachamp.gr", pathname: "/api/public/team-logo/**" },
  { protocol: "https", hostname: "ultrachamp.gr", pathname: "/api/public/team-logo/**" },
);

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

/**
 * Domains allowlist (kept for compatibility with older Next behavior)
 */
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

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    domains,
    // dangerouslyAllowSVG: true,
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  poweredByHeader: false,
  async headers() {
    const baseHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "SAMEORIGIN" },
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
        headers: [...baseHeaders, ...prodOnly],
      },
    ];
  },
};

export default nextConfig;
