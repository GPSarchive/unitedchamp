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

// 1) Supabase Storage
if (supabaseHost) {
  remotePatterns.push({
    protocol: "https",
    hostname: supabaseHost,
    pathname: "/storage/v1/object/**",
  });
}

// 2) Your own proxy (prod/custom domain)
if (appHost && appProtocol) {
  remotePatterns.push({
    protocol: appProtocol,
    hostname: appHost,
    pathname: "/api/public/team-logo/**",
  });
}

// ✅ 2a) Explicitly allow unitedchamp.vercel.app
remotePatterns.push({
  protocol: "https",
  hostname: "unitedchamp.vercel.app",
  pathname: "/api/public/team-logo/**",
});

// (Optional) If you also want preview deploys to work, use a wildcard:
// remotePatterns.push({
//   protocol: "https",
//   hostname: "**.vercel.app",
//   pathname: "/api/public/team-logo/**",
// });

// 3) Dev/local
remotePatterns.push(
  { protocol: "http", hostname: "localhost", port: "3000", pathname: "/api/public/team-logo/**" },
  { protocol: "http", hostname: "127.0.0.1", port: "3000", pathname: "/api/public/team-logo/**" },
);

// 4) Avatars
remotePatterns.push(
  { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
  { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
);

const domains = Array.from(
  new Set(
    [
      supabaseHost,
      appHost,
      // ✅ Add explicit domain so domains-based allowlist also covers it
      "unitedchamp.vercel.app",
      "localhost",
      "127.0.0.1",
      "lh3.googleusercontent.com",
      "avatars.githubusercontent.com",
    ].filter(Boolean) as string[],
  ),
);

const nextConfig: NextConfig = {
  images: {
    remotePatterns,
    domains,
    // dangerouslyAllowSVG: true,
    // contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
