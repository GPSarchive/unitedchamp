// next.config.ts
import type { NextConfig } from 'next';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseHost = SUPABASE_URL ? new URL(SUPABASE_URL).hostname : undefined;

const nextConfig = {
  images: {
    // You can keep both; or delete `domains` if you prefer only `remotePatterns`.
    domains: supabaseHost ? [supabaseHost] : [],
    remotePatterns: supabaseHost
      ? [
          {
            protocol: 'https',
            hostname: supabaseHost,
            pathname: '/storage/v1/object/**', // covers /object/sign/* and others
          },
        ]
      : [],
  },
} satisfies NextConfig;

export default nextConfig;
